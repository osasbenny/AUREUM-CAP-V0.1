import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { normalizeDomain, normalizeEmail, normalizePhone, normalizeKey } from '../server/services.mjs';
const { Pool } = pg;

function identity(record) {
  const domain = normalizeDomain(record.website || record.domain);
  const email = normalizeEmail(record.email);
  const phone = normalizePhone(record.phone);
  const companyLocation = `${normalizeKey(record.name || record.business)}|${normalizeKey(record.location)}`;
  return { domain, email, phone, companyLocation, key: domain ? `domain:${domain}` : email ? `email:${email}` : phone ? `phone:${phone}` : `company:${companyLocation}` };
}
function deduplicate(records = []) {
  const byKey = new Map();
  const events = [];
  for (const input of records) {
    const record = { ...input };
    const id = identity(record);
    const prior = byKey.get(id.key);
    if (!prior) { byKey.set(id.key, { record, id }); continue; }
    const stronger = (record.email ? 2 : 0) + (record.website ? 1 : 0) + (record.phone ? 1 : 0) > (prior.record.email ? 2 : 0) + (prior.record.website ? 1 : 0) + (prior.record.phone ? 1 : 0);
    if (record.request_type || /rfi|request|redesign/i.test(String(record.stage || ''))) events.push({ type: 'HIGH_INTENT_RFI_LINKED', record, existing_lead_id: prior.record.lead_id || prior.record.id });
    if (stronger) byKey.set(id.key, { record: { ...prior.record, ...record }, id });
    events.push({ type: 'DUPLICATE_RECONCILED', duplicate: record, kept: (stronger ? record : prior.record).lead_id || (stronger ? record : prior.record).id });
  }
  return { records: [...byKey.values()].map(({ record }) => record), events };
}

export function createRepository() {
  if (!process.env.DATABASE_URL) return null;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }, max: Number(process.env.DATABASE_POOL_MAX || 5) });
  return {
    pool,
    async health() { const result = await pool.query('select 1 as ok'); return result.rows[0].ok === 1; },
    async bootstrap(manifest, campaignName) {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;
        CREATE TABLE IF NOT EXISTS cap_leads (lead_id text PRIMARY KEY, business text NOT NULL, phone text, normalized_domain text, normalized_email text, normalized_phone text, company_location_key text, high_intent boolean NOT NULL DEFAULT false, record jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
        ALTER TABLE cap_leads ADD COLUMN IF NOT EXISTS normalized_domain text;
        ALTER TABLE cap_leads ADD COLUMN IF NOT EXISTS normalized_email text;
        ALTER TABLE cap_leads ADD COLUMN IF NOT EXISTS normalized_phone text;
        ALTER TABLE cap_leads ADD COLUMN IF NOT EXISTS company_location_key text;
        ALTER TABLE cap_leads ADD COLUMN IF NOT EXISTS high_intent boolean NOT NULL DEFAULT false;
        CREATE UNIQUE INDEX IF NOT EXISTS cap_leads_domain_uq ON cap_leads(normalized_domain) WHERE normalized_domain IS NOT NULL AND normalized_domain <> '';
        CREATE UNIQUE INDEX IF NOT EXISTS cap_leads_email_uq ON cap_leads(normalized_email) WHERE normalized_email IS NOT NULL AND normalized_email <> '';
        CREATE TABLE IF NOT EXISTS cap_queue_jobs (id uuid PRIMARY KEY, lead_id text NOT NULL, type text NOT NULL, provider text, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'QUEUED', attempts integer NOT NULL DEFAULT 0, available_at timestamptz NOT NULL DEFAULT now(), locked_at timestamptz, last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
        CREATE UNIQUE INDEX IF NOT EXISTS cap_queue_idempotency_uq ON cap_queue_jobs((payload->>'idempotency_key')) WHERE payload->>'idempotency_key' IS NOT NULL;
        CREATE INDEX IF NOT EXISTS cap_queue_jobs_status_idx ON cap_queue_jobs(status,available_at);
        CREATE TABLE IF NOT EXISTS cap_provider_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL, provider_event_id text, lead_id text, payload jsonb NOT NULL, received_at timestamptz NOT NULL DEFAULT now(), UNIQUE(provider,provider_event_id));
        CREATE TABLE IF NOT EXISTS cap_acquisition_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lead_id text, event_type text NOT NULL, source text, payload jsonb NOT NULL DEFAULT '{}', occurred_at timestamptz NOT NULL DEFAULT now());`);
      const { records, events } = deduplicate(manifest.records);
      for (const record of records) {
        const leadId = String(record.lead_id ?? record.id);
        const id = identity(record);
        await pool.query(`INSERT INTO cap_leads(lead_id,business,phone,normalized_domain,normalized_email,normalized_phone,company_location_key,high_intent,record)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT(lead_id) DO UPDATE SET business=EXCLUDED.business, phone=COALESCE(cap_leads.phone,EXCLUDED.phone), normalized_domain=COALESCE(cap_leads.normalized_domain,EXCLUDED.normalized_domain), normalized_email=COALESCE(cap_leads.normalized_email,EXCLUDED.normalized_email), normalized_phone=COALESCE(cap_leads.normalized_phone,EXCLUDED.normalized_phone), company_location_key=COALESCE(cap_leads.company_location_key,EXCLUDED.company_location_key), high_intent=cap_leads.high_intent OR EXCLUDED.high_intent, record=cap_leads.record || EXCLUDED.record, updated_at=now()`, [leadId, record.business || record.name || 'Unknown', record.phone || null, id.domain || null, id.email || null, id.phone || null, id.companyLocation, Boolean(record.request_type || record.high_intent), record]);
      }
      for (const event of events) await pool.query('INSERT INTO cap_acquisition_events(lead_id,event_type,source,payload) VALUES($1,$2,$3,$4)', [String(event.existing_lead_id || event.kept || event.record?.id || event.duplicate?.id || ''), event.type, event.record?.source || event.duplicate?.source || 'import', event]);
      return { imported: records.length, duplicates_reconciled: events.filter((e) => e.type === 'DUPLICATE_RECONCILED').length, campaign: campaignName };
    },
    async listLeads() { const result = await pool.query('SELECT record FROM cap_leads ORDER BY lead_id'); return result.rows.map((row) => row.record); },
    async saveLead(lead) { const id = identity(lead); await pool.query(`INSERT INTO cap_leads(lead_id,business,phone,normalized_domain,normalized_email,normalized_phone,company_location_key,high_intent,record) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(lead_id) DO UPDATE SET business=EXCLUDED.business,phone=EXCLUDED.phone,normalized_domain=COALESCE(EXCLUDED.normalized_domain,cap_leads.normalized_domain),normalized_email=COALESCE(EXCLUDED.normalized_email,cap_leads.normalized_email),normalized_phone=COALESCE(EXCLUDED.normalized_phone,cap_leads.normalized_phone),company_location_key=EXCLUDED.company_location_key,high_intent=EXCLUDED.high_intent,record=EXCLUDED.record,updated_at=now()`, [String(lead.uid || lead.id), lead.name || lead.business || 'Unknown', lead.phone || null, id.domain || null, id.email || null, id.phone || null, id.companyLocation, Boolean(lead.high_intent || lead.request_type), lead]); },
    async saveEvent(event) { const entityId = /^[0-9a-f-]{36}$/i.test(String(event.entity_id || '')) ? event.entity_id : null; await pool.query('INSERT INTO events(event_type,entity_type,entity_id,payload) VALUES($1,$2,$3,$4)', [event.type || event.event_type, event.entity_type || 'lead', entityId, event.payload || {}]); },
    async enqueue(job) { await pool.query('INSERT INTO cap_queue_jobs(id,lead_id,type,provider,payload,status,attempts) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING', [job.id, String(job.lead_id), job.type, job.provider, job, job.status || 'QUEUED', job.attempts || 0]); },
    async listQueue() { const result = await pool.query("SELECT payload AS job FROM cap_queue_jobs WHERE status IN ('QUEUED','RETRY') ORDER BY created_at"); return result.rows.map((row) => row.job); },
    async claimNext() { const client = await pool.connect(); try { await client.query('BEGIN'); const result = await client.query(`UPDATE cap_queue_jobs SET status='PROCESSING',locked_at=now(),updated_at=now(),attempts=attempts+1 WHERE id=(SELECT id FROM cap_queue_jobs WHERE status IN ('QUEUED','RETRY') AND available_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`); await client.query('COMMIT'); return result.rows[0] || null; } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } },
    async completeJob(id, status, error = null) { await pool.query('UPDATE cap_queue_jobs SET status=$2,last_error=$3,updated_at=now() WHERE id=$1', [id, status, error]); },
    async close() { await pool.end(); },
  };
}
export function newJobId() { return randomUUID(); }
