import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { scoreLead, matchProducts, fallbackMessage, verifyWebsite, isSuppressed, audit, PROVIDERS, uuid, checkOpenAI, checkHunter, checkSES, checkS3 } from './services.mjs';
import { routeSms, smsOpener, smsEligibility, sendTwilioSms, sendTermiiSms } from './sms.mjs';
import { createRepository } from '../db/repository.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const leadsPath = path.join(repoRoot, 'data', 'leads.json');
const port = Number(process.env.PORT || 8787);
const sessions = new Map();
function getLeads() {
  try {
    const rawLeads = JSON.parse(fs.readFileSync(leadsPath, 'utf8'));
    return rawLeads.map((lead) => {
      const productFit = matchProducts(lead)[0]?.product;
      return {
        ...lead,
        uid: String(lead.id),
        lifecycle_stage: lead.lifecycle_stage || 'SMS_APPROVED',
        website_status: lead.websiteStatus || lead.website_status || 'UNKNOWN',
        approval_state: lead.approval_state || 'APPROVED',
        sms_approval_state: lead.sms_approval_state || 'APPROVED',
        consent_status: lead.consent_status || 'ESTABLISHED',
        sms_route: routeSms(lead.phone),
        sms_message: lead.sms_message || smsOpener(lead, productFit),
        sms_status: lead.sms_status || 'PREPARED',
        suppressed: Boolean(lead.suppressed),
        score: lead.score || scoreLead(lead),
        product_fits: lead.product_fits || matchProducts(lead),
        message: lead.message || null,
        audit: lead.audit || [],
      };
    });
  } catch {
    return [];
  }
}
let leads = getLeads();
const repository = createRepository();
const repositoryReady = repository ? repository.bootstrap({ records: leads.map((lead) => ({ lead_id: lead.uid || lead.id, business: lead.name, phone: lead.phone, ...lead })) }, 'CAP V0.1 — Campaign 001 — Houston Website Opportunity').then(async () => {
  const persisted = await repository.listLeads();
  if (persisted.length) leads = persisted.map((lead) => ({ ...lead, uid: String(lead.uid || lead.id), sms_route: lead.sms_route || routeSms(lead.phone), score: lead.score || scoreLead(lead), product_fits: lead.product_fits || matchProducts(lead), audit: lead.audit || [] }));
}).catch((error) => console.error('DATABASE_INIT_FAILED', error.message)) : Promise.resolve();
const campaigns = [{ id: 'campaign-001', name: 'CAP V0.1 — Campaign 001 — Houston Website Opportunity', objective: '100-Lead SMS Pilot Campaign', status: 'ACTIVE', daily_limit: 100, batch_size: 100, approval_required: true, sender: process.env.SES_FROM_EMAIL || 'aureum.cap@cactusdigitalmedia.ng', send_enabled: true }];
const events = [];
const suppressions = [];
const queue = [];
const revenue = [];
let activeAcquisition = null;

function hydrateLead(lead) {
  const productFit = matchProducts(lead)[0]?.product;
  return {
    ...lead,
    uid: String(lead.uid || lead.id || lead.lead_id || ''),
    lifecycle_stage: lead.lifecycle_stage || lead.stage || 'IMPORTED',
    website_status: lead.website_status || lead.websiteStatus || 'UNKNOWN',
    approval_state: lead.approval_state || 'PENDING',
    sms_approval_state: lead.sms_approval_state || 'PENDING',
    consent_status: lead.consent_status || 'UNKNOWN',
    sms_route: lead.sms_route || routeSms(lead.phone),
    sms_message: lead.sms_message || smsOpener(lead, productFit),
    sms_status: lead.sms_status || null,
    suppressed: Boolean(lead.suppressed),
    score: lead.score || scoreLead(lead),
    product_fits: lead.product_fits || matchProducts(lead),
    message: lead.message || null,
    audit: lead.audit || [],
  };
}

async function refreshLeads() {
  if (repository) {
    const persisted = await repository.listLeads();
    leads = persisted.map(hydrateLead);
  } else {
    leads = getLeads().map(hydrateLead);
  }
  return leads;
}

async function recordAdminEvent(actor, eventType, entityType, entityId, payload = {}) {
  audit(events, actor, eventType, entityType, entityId, payload);
  if (repository) {
    try { await repository.recordAdminEvent({ actor, event_type: eventType, entity_type: entityType, entity_id: entityId ? String(entityId) : null, payload }); }
    catch (error) { console.error('ADMIN_EVENT_WRITE_FAILED', error.message); }
  }
}

async function configuredReadiness() {
  const database = repository ? await repository.health().then(() => ({ status: 'READY', reason: 'PostgreSQL query succeeded' })).catch((error) => ({ status: 'BLOCKED', reason: error.message })) : { status: 'BLOCKED', reason: 'DATABASE_URL not configured' };
  const [hunter, openai, email, storage] = await Promise.all([checkHunter(), checkOpenAI(), checkSES(), checkS3()]);
  return {
    database,
    storage,
    queue: { status: process.env.CAP_SQS_QUEUE_URL ? 'READY' : 'BLOCKED', reason: process.env.CAP_SQS_QUEUE_URL ? 'SQS queue configured' : 'CAP_SQS_QUEUE_URL missing' },
    hunter,
    openai,
    email,
    send_gate: { status: process.env.CAP_SEND_ENABLED === 'true' ? 'ENABLED' : 'DISABLED', reason: 'CAP_SEND_ENABLED' },
    sms_provider: { status: (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) ? 'READY' : 'BLOCKED', reason: (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) ? 'Twilio credentials configured' : 'Twilio credentials incomplete' },
    sms_send_gate: { status: process.env.CAP_SMS_SEND_ENABLED === 'true' ? 'ENABLED' : 'DISABLED', reason: 'CAP_SMS_SEND_ENABLED' },
    website_verifier: { status: 'READY', reason: 'HTTP/DNS verifier built in' },
    fallback_messages: { status: 'READY', reason: 'Deterministic fallback template available' }
  };
}

function runAcquisition({ target = 1000, actor = 'operator' } = {}) {
  if (activeAcquisition?.status === 'RUNNING') return activeAcquisition;
  const runId = `manual-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const child = spawn(process.execPath, [path.join(repoRoot, 'scripts', 'acquisition-engine.mjs')], {
    cwd: repoRoot,
    env: { ...process.env, CAP_DAILY_ACQUISITION_TARGET: String(Math.min(Math.max(Number(target) || 1000, 1), 1000)) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  activeAcquisition = { run_id: runId, status: 'RUNNING', pid: child.pid, target: Math.min(Math.max(Number(target) || 1000, 1), 1000), started_at: new Date().toISOString(), actor, log_tail: '' };
  const append = (chunk) => {
    activeAcquisition.log_tail = (activeAcquisition.log_tail + String(chunk)).slice(-12000);
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.on('exit', async (code, signal) => {
    activeAcquisition = { ...activeAcquisition, status: code === 0 ? 'COMPLETED' : 'FAILED', exit_code: code, signal: signal || null, completed_at: new Date().toISOString() };
    await recordAdminEvent(actor, code === 0 ? 'acquisition.completed' : 'acquisition.failed', 'acquisition_run', runId, { target: activeAcquisition.target, exit_code: code, signal, log_tail: activeAcquisition.log_tail });
    try { await refreshLeads(); } catch {}
  });
  return activeAcquisition;
}

function json(res, status, payload) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(payload)); }
function parseCookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map((p) => { const [k, ...v] = p.trim().split('='); return [k, decodeURIComponent(v.join('='))]; })); }
function auth(req) { const token = parseCookies(req).cap_session; return token && sessions.get(token); }
function requireAuth(req, res) { const user = auth(req); if (!user) { json(res, 401, { error: 'unauthorized', message: 'Login required' }); return null; } return user; }
async function body(req) { let raw = ''; for await (const chunk of req) raw += chunk; if (!raw) return {}; try { return JSON.parse(raw); } catch { return {}; } }
async function formBody(req) { let raw = ''; for await (const chunk of req) raw += chunk; return Object.fromEntries(new URLSearchParams(raw)); }
function validTwilioWebhook(req, params) { const token = process.env.TWILIO_AUTH_TOKEN; if (!token) return false; const signature = req.headers['x-twilio-signature']; if (!signature) return false; const url = `${process.env.PUBLIC_API_BASE_URL || `http://${req.headers.host}`}${req.url}`; const data = url + Object.keys(params).sort().map((key) => `${key}${params[key]}`).join(''); const expected = crypto.createHmac('sha1', token).update(data).digest('base64'); const actualBuffer = Buffer.from(String(signature)); const expectedBuffer = Buffer.from(expected); return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer); }
function dashboard() { const count = (fn) => leads.filter(fn).length; return { imported: leads.length, verified: count((l) => l.website_status === 'ACTIVE'), enriched: count((l) => Boolean(l.email)), qualified: count((l) => l.score.total >= 60), awaiting_approval: count((l) => l.approval_state === 'PENDING'), approved: count((l) => l.approval_state === 'APPROVED'), sms_prepared: count((l) => l.sms_status === 'PREPARED'), sms_approved: count((l) => l.sms_approval_state === 'APPROVED'), scheduled: count((l) => l.lifecycle_stage === 'SCHEDULED'), queued: queue.filter((j) => j.status === 'QUEUED').length, sent: count((l) => l.lifecycle_stage === 'SENT'), delivered: count((l) => l.lifecycle_stage === 'DELIVERED'), bounced: count((l) => l.lifecycle_stage === 'BOUNCED'), replied: count((l) => l.lifecycle_stage === 'REPLIED'), positive_replies: count((l) => l.response?.classification === 'POSITIVE'), opportunities: count((l) => l.opportunity), pipeline_value: revenue.reduce((s, r) => s + Number(r.expected_value || 0), 0), expected_revenue: revenue.reduce((s, r) => s + Number(r.expected_revenue || 0), 0), won_revenue: revenue.filter((r) => r.status === 'WON').reduce((s, r) => s + Number(r.amount || 0), 0), by_category: Object.fromEntries([...new Set(leads.map((l) => l.category))].map((c) => [c, count((l) => l.category === c)])), send_enabled: process.env.CAP_SEND_ENABLED === 'true', sms_send_enabled: process.env.CAP_SMS_SEND_ENABLED === 'true' }; }
function findLead(id) { return leads.find((l) => l.uid === String(id) || String(l.id) === String(id)); }
function notFound(res) { return json(res, 404, { error: 'not_found' }); }
async function persistLead(lead) { if (repository) await repository.saveLead(lead); }

const server = http.createServer(async (req, res) => {
  await repositoryReady;
  await refreshLeads();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const allowedOrigin = process.env.FRONTEND_ORIGIN || `http://${req.headers.host || 'localhost'}`;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Headers': 'Content-Type, Cookie, X-Requested-With' }); return res.end(); }
  if (url.pathname === '/health' && req.method === 'GET') return json(res, 200, { ok: true, service: 'aureum-cap-v0-1', region: process.env.AWS_REGION || 'eu-north-1', send_enabled: process.env.CAP_SEND_ENABLED === 'true' });
  if (url.pathname === '/export/csv' || url.pathname === '/api/v1/export/csv') {
    const exportUser = requireAuth(req, res); if (!exportUser) return;
    const emailOnly = url.searchParams.get('email_only') === 'true';
    const ids = new Set((url.searchParams.get('ids') || '').split(',').filter(Boolean));
    const leadsList = (repository ? await repository.listLeads() : leads)
      .map((l) => l.record || l)
      .filter((record) => (!emailOnly || Boolean(String(record.email || '').trim())) && (!ids.size || ids.has(String(record.id || record.uid || record.lead_id || ''))));
    const headers = ['ID', 'Business Name', 'Category', 'Location', 'Phone', 'Email', 'Website', 'Internet Presence', 'Email Status', 'Stage', 'Acquisition Source', 'Acquisition Date'];
    const rows = [headers.join(',')];
    for (const record of leadsList) {
      rows.push([
        record.id || record.uid || record.lead_id || '',
        `"${String(record.name || record.business || '').replace(/"/g, '""')}"`,
        `"${String(record.category || '').replace(/"/g, '""')}"`,
        `"${String(record.location || '').replace(/"/g, '""')}"`,
        `"${String(record.phone || '').replace(/"/g, '""')}"`,
        `"${String(record.email || '').replace(/"/g, '""')}"`,
        `"${String(record.website || '').replace(/"/g, '""')}"`,
        `"${String(record.internet_presence || record.website_status || '').replace(/"/g, '""')}"`,
        `"${String(record.email_verification?.status || record.email_status || '').replace(/"/g, '""')}"`,
        `"${String(record.lifecycle_stage || record.stage || '').replace(/"/g, '""')}"`,
        `"${String(record.source || '').replace(/"/g, '""')}"`,
        `"${String(record.acquisition_date || record.discovered_at || '').replace(/"/g, '""')}"`
      ].join(','));
    }
    await recordAdminEvent(exportUser.email, 'leads.exported', 'lead', null, { count: leadsList.length, email_only: emailOnly, selected: ids.size });
    const filename = emailOnly ? 'cap-email-ready-leads.csv' : ids.size ? 'cap-selected-leads.csv' : 'cap-production-leads.csv';
    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` });
    return res.end(rows.join('\n'));
  }
  if (url.pathname === '/readiness' && req.method === 'GET') { const readiness = await configuredReadiness(); const blocked = Object.entries(readiness).filter(([key, value]) => !['send_gate','sms_send_gate'].includes(key) && !['READY','ENABLED'].includes(value?.status)).map(([key]) => key); return json(res, blocked.length ? 503 : 200, { ready: blocked.length === 0, readiness, blocked, policy: 'No live send is permitted without provider readiness, suppression checks, and human approval.' }); }
  if (url.pathname === '/api/v1/webhooks/sms/status' && req.method === 'POST') { const params = await formBody(req); if (!validTwilioWebhook(req, params)) return json(res, 403, { error: 'invalid_twilio_signature' }); const lead = leads.find((item) => item.sms_provider_id === params.MessageSid); if (lead) { lead.sms_status = params.MessageStatus || lead.sms_status; lead.lifecycle_stage = params.MessageStatus === 'delivered' ? 'DELIVERED' : params.MessageStatus === 'undelivered' || params.MessageStatus === 'failed' ? 'BOUNCED' : lead.lifecycle_stage; await persistLead(lead); } if (repository) await repository.saveEvent({ type: 'sms.status', entity_type: 'lead', entity_id: null, payload: params }); return json(res, 200, { ok: true }); }
  if (url.pathname === '/api/v1/webhooks/sms/inbound' && req.method === 'POST') { const params = await formBody(req); if (!validTwilioWebhook(req, params)) return json(res, 403, { error: 'invalid_twilio_signature' }); const lead = leads.find((item) => item.phone === params.From || item.sms_route?.phone === params.From); const text = String(params.Body || '').trim(); if (lead) { lead.response = { classification: /^(stop|unsubscribe|cancel|quit|end|revoke)$/i.test(text) ? 'OPT_OUT' : 'RECEIVED', body: text, received_at: new Date().toISOString() }; lead.lifecycle_stage = 'REPLIED'; if (lead.response.classification === 'OPT_OUT') { lead.sms_suppressed = true; lead.suppressed = true; suppressions.push({ phone: lead.phone, reason: 'recipient_opt_out', source: 'twilio', created_at: new Date().toISOString() }); } await persistLead(lead); } if (repository) await repository.saveEvent({ type: 'sms.inbound', entity_type: 'lead', entity_id: null, payload: params }); res.writeHead(200, { 'Content-Type': 'text/xml' }); return res.end('<Response></Response>'); }
  if (url.pathname === '/api/v1/auth/login' && req.method === 'POST') { const b = await body(req); const email = String(b.email || ''); const expectedEmail = process.env.CAP_ADMIN_EMAIL; const expectedPassword = process.env.CAP_ADMIN_PASSWORD; if (!expectedEmail || !expectedPassword) return json(res, 503, { error: 'auth_not_configured', message: 'Production authentication is not configured.' }); if (email !== expectedEmail || b.password !== expectedPassword) return json(res, 401, { error: 'invalid_credentials' }); const token = uuid(); const user = { id: 'operator-1', email, role: 'admin', name: 'Aureum CAP Operator' }; sessions.set(token, user); const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''; res.setHeader('Set-Cookie', `cap_session=${encodeURIComponent(token)}; HttpOnly; SameSite=None${secure}; Path=/`); return json(res, 200, { user }); }
  if (url.pathname === '/api/v1/auth/me' && req.method === 'GET') { const user = auth(req); return user ? json(res, 200, { user }) : json(res, 401, { error: 'unauthorized' }); }
  if (url.pathname === '/api/v1/auth/logout' && req.method === 'POST') { const token = parseCookies(req).cap_session; sessions.delete(token); res.setHeader('Set-Cookie', 'cap_session=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/'); return json(res, 200, { ok: true }); }
  if (url.pathname === '/api/v1/pilot/summary' && req.method === 'GET') return json(res, 200, { campaign: campaigns[0].name, total_leads: leads.length, ...dashboard(), mode: 'production-admin' });
  const user = requireAuth(req, res); if (!user) return;
  if (url.pathname === '/api/v1/dashboard' && req.method === 'GET') return json(res, 200, dashboard());
  if (url.pathname === '/api/v1/acquisition/run' && req.method === 'POST') {
    const b = await body(req);
    if (activeAcquisition?.status === 'RUNNING') return json(res, 409, { error: 'acquisition_already_running', data: activeAcquisition });
    const run = runAcquisition({ target: b.target || 1000, actor: user.email });
    await recordAdminEvent(user.email, 'acquisition.requested', 'acquisition_run', run.run_id, { target: run.target, pid: run.pid });
    return json(res, 202, { data: run });
  }
  if (url.pathname === '/api/v1/acquisition/runs' && req.method === 'GET') {
    const history = repository ? await repository.listAcquisitionRuns(100) : [];
    return json(res, 200, { active: activeAcquisition, data: history });
  }
  if (url.pathname === '/api/v1/conversations' && req.method === 'GET') {
    const data = leads.filter((l) => l.response || ['REPLIED','REQUESTED_INFORMATION','HUMAN_FOLLOWUP'].includes(l.lifecycle_stage)).map((l) => ({
      lead_id: l.uid, name: l.name || l.business, email: l.email || null, phone: l.phone || null, stage: l.lifecycle_stage,
      response: l.response || null, updated_at: l.response?.received_at || l.updated_at || l.acquisition_date || null
    }));
    return json(res, 200, { data });
  }
  if (url.pathname === '/api/v1/leads' && req.method === 'GET') { const q = (url.searchParams.get('q') || '').toLowerCase(); const status = url.searchParams.get('status'); const result = leads.filter((l) => (!q || `${l.name} ${l.category} ${l.location}`.toLowerCase().includes(q)) && (!status || l.lifecycle_stage === status)); return json(res, 200, { data: result, total: result.length }); }
  const leadMatch = url.pathname.match(/^\/api\/v1\/leads\/([^/]+)$/); if (leadMatch && req.method === 'GET') { const lead = findLead(leadMatch[1]); return lead ? json(res, 200, { data: lead }) : notFound(res); }
  if (leadMatch && req.method === 'PATCH') { const lead = findLead(leadMatch[1]); if (!lead) return notFound(res); const patch = await body(req); Object.assign(lead, { ...patch, uid: lead.uid, id: lead.id }); await persistLead(lead); await recordAdminEvent(user.email, 'lead.updated', 'lead', lead.uid, patch); return json(res, 200, { data: lead }); }
  const actionMatch = url.pathname.match(/^\/api\/v1\/leads\/([^/]+)\/(approve|reject|suppress|verify|prepare|prepare-sms|approve-sms|queue-sms|send-sms)$/); if (actionMatch && req.method === 'POST') { const lead = findLead(actionMatch[1]); if (!lead) return notFound(res); const action = actionMatch[2]; if (action === 'approve') { if (lead.suppressed || isSuppressed(lead, suppressions)) return json(res, 409, { error: 'suppressed', message: 'Suppressed leads cannot be approved.' }); lead.approval_state = 'APPROVED'; lead.lifecycle_stage = 'APPROVED'; } if (action === 'reject') { lead.approval_state = 'REJECTED'; lead.lifecycle_stage = 'REJECTED'; } if (action === 'suppress') { lead.suppressed = true; lead.approval_state = 'REJECTED'; lead.sms_approval_state = 'REJECTED'; lead.lifecycle_stage = 'SUPPRESSED'; suppressions.push({ key: `${lead.name} ${lead.phone}`.toLowerCase(), phone: lead.phone, reason: 'manual', created_at: new Date().toISOString() }); } if (action === 'verify') { lead.website_audit = await verifyWebsite(lead.website); lead.website_status = lead.website_audit.status; lead.lifecycle_stage = lead.website_status === 'ACTIVE' ? 'VERIFIED' : lead.lifecycle_stage; } if (action === 'prepare') { lead.message = fallbackMessage(lead, lead.product_fits[0]); lead.lifecycle_stage = 'MESSAGE_READY'; } if (action === 'prepare-sms') { lead.sms_message = smsOpener(lead, lead.product_fits[0]?.product); lead.sms_status = 'PREPARED'; lead.lifecycle_stage = 'SMS_REVIEW'; } if (action === 'approve-sms') { if (lead.sms_status !== 'PREPARED') return json(res, 409, { error: 'sms_not_prepared' }); lead.sms_approval_state = 'APPROVED'; lead.lifecycle_stage = 'SMS_APPROVED'; } if (action === 'queue-sms') { const eligibility = smsEligibility(lead); if (!eligibility.eligible) return json(res, 409, { error: 'sms_not_eligible', reason: eligibility.reason, route: eligibility.route }); const job = { id: uuid(), type: 'SMS_SEND', lead_id: lead.uid, provider: eligibility.route.provider, to: eligibility.route.phone, body: lead.sms_message, status: 'QUEUED', attempts: 0, created_at: new Date().toISOString() }; queue.push(job); if (repository) await repository.enqueue(job); lead.sms_status = 'QUEUED'; lead.lifecycle_stage = 'SMS_QUEUED'; } if (action === 'send-sms') { if (process.env.CAP_SMS_SEND_ENABLED !== 'true') return json(res, 409, { error: 'sms_send_disabled', message: 'SMS sending is disabled until the operator enables the provider gate.' }); const eligibility = smsEligibility(lead); if (!eligibility.eligible) return json(res, 409, { error: 'sms_not_eligible', reason: eligibility.reason, route: eligibility.route }); const sendArgs = { to: eligibility.route.phone, body: lead.sms_message, statusCallback: process.env.SMS_STATUS_CALLBACK_URL }; const result = eligibility.route.provider === 'twilio' ? await sendTwilioSms(sendArgs) : await sendTermiiSms(sendArgs); lead.sms_provider_id = result.provider_id; lead.sms_status = result.status; lead.sms_sent_at = new Date().toISOString(); lead.lifecycle_stage = 'SENT'; await recordAdminEvent(user.email, 'lead.sms.sent', 'lead', lead.uid, { provider: result.provider, provider_id: result.provider_id }); await persistLead(lead); return json(res, 200, { data: lead, provider: result }); } await persistLead(lead); await recordAdminEvent(user.email, `lead.${action}`, 'lead', lead.uid); return json(res, 200, { data: lead }); }
  if (url.pathname === '/api/v1/approvals' && req.method === 'GET') return json(res, 200, { data: leads.filter((l) => l.approval_state === 'PENDING') });
  if (url.pathname === '/api/v1/approvals/bulk' && req.method === 'POST') { const b = await body(req); const ids = Array.isArray(b.ids) ? b.ids : []; const updated = ids.map(findLead).filter(Boolean).filter((l) => !l.suppressed).map((l) => { l.approval_state = 'APPROVED'; l.lifecycle_stage = 'APPROVED'; recordAdminEvent(user.email, 'lead.approved', 'lead', l.uid, { bulk: true }); return l; }); await Promise.all(updated.map(persistLead)); return json(res, 200, { approved: updated.map((l) => l.uid) }); }
  if (url.pathname === '/api/v1/campaigns' && req.method === 'GET') return json(res, 200, { data: campaigns });
  if (url.pathname === '/api/v1/campaigns' && req.method === 'POST') { const b = await body(req); const campaign = { id: uuid(), status: 'DRAFT', approval_required: true, send_enabled: false, ...b }; campaigns.push(campaign); await recordAdminEvent(user.email, 'campaign.created', 'campaign', campaign.id); return json(res, 201, { data: campaign }); }
  const campaignMatch = url.pathname.match(/^\/api\/v1\/campaigns\/([^/]+)(?:\/(approve|start|pause|resume|stop))?$/); if (campaignMatch) { const campaign = campaigns.find((c) => c.id === campaignMatch[1]); if (!campaign) return notFound(res); if (req.method === 'PATCH') Object.assign(campaign, await body(req)); if (req.method === 'POST' && campaignMatch[2]) { const action = campaignMatch[2]; if (action === 'approve') campaign.status = 'APPROVED'; if (action === 'start') { if (campaign.status !== 'APPROVED') return json(res, 409, { error: 'approval_required' }); campaign.status = 'ACTIVE'; } if (action === 'pause') campaign.status = 'PAUSED'; if (action === 'resume') campaign.status = 'ACTIVE'; if (action === 'stop') campaign.status = 'COMPLETED'; await recordAdminEvent(user.email, `campaign.${action}`, 'campaign', campaign.id); } return json(res, 200, { data: campaign }); }
  if (url.pathname === '/api/v1/queue' && req.method === 'GET') return json(res, 200, { data: repository ? await repository.listQueue() : queue });
  if (url.pathname === '/api/v1/events' && req.method === 'GET') return json(res, 200, { data: repository ? await repository.listAdminEvents(300) : events });
  if (url.pathname === '/api/v1/revenue' && req.method === 'GET') return json(res, 200, { data: revenue, totals: dashboard() });
  if (url.pathname === '/api/v1/products' && req.method === 'GET') return json(res, 200, { data: [...new Set(leads.flatMap((l) => l.product_fits.map((p) => p.product)))] });
  const fitMatch = url.pathname.match(/^\/api\/v1\/product-fit\/([^/]+)$/); if (fitMatch && req.method === 'GET') { const lead = findLead(fitMatch[1]); return lead ? json(res, 200, { data: lead.product_fits }) : notFound(res); }
  return notFound(res);
});
server.listen(port, '0.0.0.0', () => console.log(`CAP API listening on ${port}`));
process.on('SIGTERM', () => server.close(() => process.exit(0))); process.on('SIGINT', () => server.close(() => process.exit(0)));
