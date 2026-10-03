import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import OpenAI from 'openai';
import { SESv2Client, GetAccountCommand, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION || 'eu-north-1';
const timeoutMs = Number(process.env.CAP_PROVIDER_TIMEOUT_MS || 12000);
const cache = new Map();
export const PROVIDERS = {
  AIProvider: { name: 'openai-responses', enabled: Boolean(process.env.OPENAI_API_KEY) },
  EmailFinderProvider: { name: 'hunter', enabled: Boolean(process.env.HUNTER_API_KEY) },
  EmailVerificationProvider: { name: 'hunter', enabled: Boolean(process.env.HUNTER_API_KEY) },
  EmailProvider: { name: 'aws-ses', enabled: Boolean(process.env.SES_FROM_EMAIL) },
  QueueProvider: { name: 'aws-sqs', enabled: Boolean(process.env.CAP_SQS_QUEUE_URL) },
  StorageProvider: { name: 'aws-s3', enabled: Boolean(process.env.CAP_S3_BUCKET) },
  WebsiteVerificationProvider: { name: 'cap-http-verifier', enabled: true },
};

const withTimeout = (promise, ms = timeoutMs) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('provider_timeout')), ms))]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function retry(fn, attempts = 3) { let last; for (let i = 0; i < attempts; i += 1) { try { return await fn(i); } catch (error) { last = error; if (i + 1 < attempts && (!error.status || error.status === 429 || error.status >= 500)) await sleep(250 * 2 ** i); } } throw last; }
function cached(key, ttlMs, fn) { const item = cache.get(key); if (item && item.expires > Date.now()) return item.value; const value = fn(); cache.set(key, { value, expires: Date.now() + ttlMs }); return value; }

export function normalizeKey(value = '') { return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
export function normalizeDomain(value = '') { return String(value).toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '').trim(); }
export function normalizeEmail(value = '') { return String(value).trim().toLowerCase(); }
export function normalizePhone(value = '') { const digits = String(value).replace(/\D/g, ''); return digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith('1') ? `+${digits}` : value ? `+${digits}` : ''; }

export function scoreLead(lead) {
  const text = normalizeKey(`${lead.name} ${lead.category} ${lead.location}`);
  const components = { company_fit: lead.category ? 75 : 0, buying_signal: /(houston|texas|usa|united states)/i.test(text) ? 80 : 40, website_opportunity: lead.website ? 55 : 70, decision_maker: 35, contact_quality: lead.phone || lead.email ? 70 : 20, location: /(houston|texas)/i.test(text) ? 90 : 45, business_size: 50 };
  const weights = { company_fit: .25, buying_signal: .20, website_opportunity: .20, decision_maker: .15, contact_quality: .10, location: .05, business_size: .05 };
  return { total: Math.round(Object.entries(components).reduce((sum, [key, value]) => sum + value * weights[key], 0) * 100) / 100, components, version: 'deterministic-v0.2', evidence: ['business_metadata', 'contact_presence', 'location_match'], scored_at: new Date().toISOString() };
}
export function matchProducts(lead) { const category = normalizeKey(lead.category); const fits = []; const add = (product, score, evidence) => fits.push({ product, score, evidence }); if (/restaurant|food|bar|cafe/.test(category)) add('AuraPOS', 88, 'Restaurant/food business category'); if (/church|faith|religious/.test(category)) add('FaithConnect', 88, 'Church/faith organization category'); if (/freelancer|agency|consult/.test(category)) add('AuraReach', 84, 'Freelancer/agency category'); if (/startup|software|technology/.test(category)) add('Custom Software', 82, 'Technology/startup category'); if (/ngo|nonprofit|fundraiser/.test(category)) add('Business Automation', 72, 'Nonprofit/fundraising operations'); add('Premium Website Development', lead.website ? 64 : 82, lead.website ? 'Website opportunity requires audit' : 'No verified website supplied'); add('Business Automation', 58, 'General operational improvement hypothesis'); return fits.sort((a, b) => b.score - a.score); }
export function fallbackMessage(lead, fit) { const business = lead.name || 'your business'; const product = fit?.product || 'a stronger digital operating system'; return { provider: 'TEMPLATE/FALLBACK', version: 'template-v0.2', subject: `A practical growth idea for ${business}`, body: `Hello,\n\nI’m reaching out because ${business} may be a strong fit for ${product}. We help growing businesses improve their digital customer journey and operational follow-through.\n\nIf this is relevant, would a short conversation next week be useful?\n\nRegards,\nAureum CAP`, approval_required: true, evidence: ['business name', 'category', 'deterministic product fit'] }; }

export async function openaiResponses(input, schema) { if (!process.env.OPENAI_API_KEY) throw new Error('openai_not_configured'); const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, baseURL: process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE, timeout: timeoutMs, maxRetries: 0 }); const response = await retry(() => withTimeout(client.responses.create({ model: process.env.OPENAI_MODEL || 'gpt-5.6-luna', input, ...(schema ? { text: { format: { type: 'json_schema', name: schema.name, strict: true, schema: schema.schema } } } : {}) }))); return { id: response.id, model: response.model, output_text: response.output_text, usage: response.usage || null }; }
export async function checkOpenAI() { return cached('openai', 30000, async () => { try { const r = await openaiResponses('Return the single word READY.', null); return { status: 'READY', reason: 'Authenticated Responses API operation succeeded', model: r.model, request_id: r.id }; } catch (error) { return { status: 'BLOCKED', reason: String(error.message).slice(0, 180) }; } }); }

async function hunter(path, params = {}) { if (!process.env.HUNTER_API_KEY) throw new Error('hunter_not_configured'); const query = new URLSearchParams({ api_key: process.env.HUNTER_API_KEY, ...params }); const res = await withTimeout(fetch(`https://api.hunter.io/v2/${path}?${query}`)); const data = await res.json().catch(() => ({})); if (!res.ok) { const e = new Error(data?.errors?.[0]?.details || `hunter_http_${res.status}`); e.status = res.status; throw e; } return data; }
export async function hunterDomainSearch(domain) { return hunter('domain-search', { domain: normalizeDomain(domain), limit: 10 }); }
export async function hunterEmailVerifier(email) { return hunter('email-verifier', { email: normalizeEmail(email) }); }
export async function hunterEmailFinder(fullName, domain) { return hunter('email-finder', { full_name: fullName, domain: normalizeDomain(domain) }); }
export async function checkHunter() { return cached('hunter', 60000, async () => { try { const res = await withTimeout(fetch(`https://api.hunter.io/v2/account?api_key=${encodeURIComponent(process.env.HUNTER_API_KEY || '')}`)); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data?.errors?.[0]?.details || `hunter_http_${res.status}`); const credits = data.data?.requests || data.data?.plan || {}; return { status: 'READY', reason: 'Authenticated Hunter account request succeeded', quota: { search: credits.searches || credits.search || null, verification: credits.verifications || credits.verification || null } }; } catch (error) { return { status: 'DEGRADED', reason: String(error.message).slice(0, 180) }; } }); }

const ses = new SESv2Client({ region });
export async function checkSES() { return cached('ses', 60000, async () => { try { const r = await ses.send(new GetAccountCommand({})); return { status: 'READY', reason: 'SES account status read succeeded', production_access: Boolean(r.ProductionAccessEnabled), send_quota: r.SendQuota || null }; } catch (error) { return { status: 'BLOCKED', reason: String(error.message).slice(0, 180) }; } }); }
export async function sendSESEmail({ to, subject, body, campaignId, leadId }) { if (process.env.CAP_EMAIL_SEND_ENABLED !== 'true') throw new Error('email_send_disabled'); if (!process.env.SES_FROM_EMAIL) throw new Error('ses_sender_not_configured'); const result = await ses.send(new SendEmailCommand({ FromEmailAddress: process.env.SES_FROM_EMAIL, Destination: { ToAddresses: [to] }, Content: { Simple: { Subject: { Data: subject, Charset: 'UTF-8' }, Body: { Text: { Data: body, Charset: 'UTF-8' } } } }, EmailTags: [{ Name: 'campaign_id', Value: String(campaignId || '') }, { Name: 'lead_id', Value: String(leadId || '') }] })); return { provider: 'aws-ses', provider_id: result.MessageId, status: 'ACCEPTED', accepted_at: new Date().toISOString() }; }
export async function checkS3() { if (!process.env.CAP_S3_BUCKET) return { status: 'BLOCKED', reason: 'bucket_not_configured' }; try { await new S3Client({ region }).send(new HeadBucketCommand({ Bucket: process.env.CAP_S3_BUCKET })); return { status: 'READY', reason: 'S3 bucket head succeeded' }; } catch (error) { return { status: 'BLOCKED', reason: String(error.message).slice(0, 180) }; } }

export async function verifyWebsite(website) { if (!website) return { status: 'UNKNOWN', evidence: ['No website supplied'], checked_at: new Date().toISOString() }; let url = String(website).trim(); if (!/^https?:\/\//i.test(url)) url = `https://${url}`; const started = Date.now(); try { const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(7000) }); return { status: response.ok ? 'ACTIVE' : 'ERROR', http_status: response.status, final_url: response.url, evidence: [`HTTP ${response.status}`, 'redirects resolved', `latency_ms ${Date.now() - started}`], checked_at: new Date().toISOString() }; } catch (error) { try { await dns.lookup(new URL(url).hostname); return { status: 'BLOCKED', evidence: ['DNS resolves but HTTP check failed', String(error.message).slice(0, 160)], checked_at: new Date().toISOString() }; } catch { return { status: 'NOT_FOUND', evidence: ['DNS lookup failed', String(error.message).slice(0, 160)], checked_at: new Date().toISOString() }; } } }
export function isSuppressed(lead, suppressions) { const key = normalizeKey(`${lead.name} ${lead.phone}`); return suppressions.some((s) => s.key === key || (lead.phone && s.phone === lead.phone) || (lead.email && normalizeEmail(s.email) === normalizeEmail(lead.email))); }
export function audit(events, actor, eventType, entityType, entityId, payload = {}) { events.unshift({ id: crypto.randomUUID(), actor, event_type: eventType, entity_type: entityType, entity_id: entityId, payload, occurred_at: new Date().toISOString() }); }
export function uuid() { return crypto.randomUUID(); }
