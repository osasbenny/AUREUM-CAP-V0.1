#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import { classifyInternetPresence, scoreLead, matchProducts, fallbackMessage, normalizeDomain, normalizeEmail, normalizePhone } from '../server/services.mjs';
import { createRepository, reconcileRecords } from '../db/repository.mjs';
import { discoverOverpass } from './discovery-overpass.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = process.env.CAP_DISCOVERY_INPUT || path.join(root, 'data', 'discovery-inbox.json');
const target = Math.min(Math.max(Number(process.env.CAP_DAILY_ACQUISITION_TARGET || 1000), 1), 1000);
const rawLimit = Math.min(Math.max(Number(process.env.CAP_DISCOVERY_RAW_LIMIT || target * 5), target), 10000);
const provider = process.env.CAP_DISCOVERY_PROVIDER || 'overpass';
const queueUrl = process.env.CAP_SQS_QUEUE_URL;
const region = process.env.AWS_REGION || 'eu-north-1';

const repository = createRepository();
if (!repository) throw new Error('DATABASE_URL_required_for_production_acquisition');
if (!queueUrl) throw new Error('CAP_SQS_QUEUE_URL_required_for_production_acquisition');

const discovered = provider === 'overpass'
  ? await discoverOverpass({ limit: rawLimit })
  : (fs.existsSync(inputPath) ? JSON.parse(fs.readFileSync(inputPath, 'utf8')) : []);

if (!Array.isArray(discovered)) throw new Error('discovery_results_must_be_array');

const existing = await repository.listLeads();
const combined = reconcileRecords([...existing, ...discovered]);
const existingKeys = new Set(existing.flatMap((r) => [
  normalizeDomain(r.website),
  normalizeEmail(r.email),
  normalizePhone(r.phone),
  `${String(r.name || r.business || '').toLowerCase()}|${String(r.location || r.address || '').toLowerCase()}`
].filter(Boolean)));

const isNew = (record) => {
  const keys = [
    normalizeDomain(record.website),
    normalizeEmail(record.email),
    normalizePhone(record.phone),
    `${String(record.name || record.business || '').toLowerCase()}|${String(record.location || record.address || '').toLowerCase()}`
  ].filter(Boolean);
  return keys.length > 0 && keys.every((key) => !existingKeys.has(key));
};

const newRecords = combined.records.filter(isNew).slice(0, target);
const metrics = {
  source: provider === 'overpass' ? 'openstreetmap-overpass' : path.basename(inputPath),
  discovered: discovered.length,
  duplicates: Math.max(0, discovered.length - newRecords.length),
  new_unique: newRecords.length,
  no_web_presence: 0,
  social_only: 0,
  weak_website: 0,
  domain_prospects: 0,
  enriched: 0,
  verified_email: 0,
  phone_only: 0,
  rejected: 0
};

const jobs = [];
for (const raw of newRecords) {
  const id = raw.uid || raw.id || `acq-${randomUUID()}`;
  const lead = {
    ...raw,
    uid: id,
    id,
    internet_presence: classifyInternetPresence(raw),
    acquisition_date: new Date().toISOString(),
    lifecycle_stage: 'ACQUIRED'
  };

  if (lead.internet_presence === 'NO_WEB_PRESENCE') metrics.no_web_presence += 1;
  if (lead.internet_presence === 'SOCIAL_ONLY') metrics.social_only += 1;
  if (['WEAK_WEBSITE', 'OUTDATED_WEBSITE'].includes(lead.internet_presence)) metrics.weak_website += 1;
  if (lead.website || lead.domain) metrics.domain_prospects += 1;
  if (!lead.email && lead.phone) metrics.phone_only += 1;

  lead.score = scoreLead(lead);
  lead.product_fits = matchProducts(lead);
  lead.message = fallbackMessage(lead, lead.product_fits[0]);

  if (lead.website || lead.domain) {
    jobs.push({
      id: randomUUID(),
      type: 'LEAD_ENRICH',
      lead_id: id,
      provider: 'hunter',
      domain: normalizeDomain(lead.website || lead.domain),
      status: 'QUEUED',
      attempts: 0,
      created_at: new Date().toISOString()
    });
  }
  if (lead.email) {
    jobs.push({
      id: randomUUID(),
      type: 'EMAIL_VERIFY',
      lead_id: id,
      provider: 'hunter',
      email: normalizeEmail(lead.email),
      status: 'QUEUED',
      attempts: 0,
      created_at: new Date().toISOString()
    });
  }
  jobs.push({
    id: randomUUID(),
    type: 'OPENAI_QUALIFY',
    lead_id: id,
    provider: 'openai',
    status: 'QUEUED',
    attempts: 0,
    created_at: new Date().toISOString()
  });

  await repository.saveLead(lead);
}

const sqs = new SQSClient({ region });
for (let i = 0; i < jobs.length; i += 10) {
  const batch = jobs.slice(i, i + 10);
  await Promise.all(batch.map((job) => repository.enqueue(job)));
  const response = await sqs.send(new SendMessageBatchCommand({
    QueueUrl: queueUrl,
    Entries: batch.map((job) => ({
      Id: job.id.replace(/-/g, '').slice(0, 80),
      MessageBody: JSON.stringify(job)
    }))
  }));
  if (response.Failed?.length) {
    throw new Error(`sqs_batch_failed:${response.Failed.map((x) => x.Code || x.Id).join(',')}`);
  }
}

await repository.recordAcquisitionRun(metrics);

const result = {
  ok: newRecords.length === target,
  target,
  raw_limit: rawLimit,
  existing_before: existing.length,
  ...metrics,
  shortfall: Math.max(0, target - newRecords.length),
  enrichment_jobs_queued: jobs.filter((j) => j.type === 'LEAD_ENRICH').length,
  verification_jobs_queued: jobs.filter((j) => j.type === 'EMAIL_VERIFY').length,
  qualification_jobs_queued: jobs.filter((j) => j.type === 'OPENAI_QUALIFY').length,
  total_jobs_queued: jobs.length
};

console.log(JSON.stringify(result, null, 2));
await repository.close();

if (newRecords.length < target) {
  throw new Error(`acquisition_target_shortfall:${newRecords.length}/${target}`);
}
