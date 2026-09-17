import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchProducts, scoreLead, fallbackMessage } from '../server/services.mjs';
import { normalizeE164, routeSms, smsOpener, smsEligibility } from '../server/sms.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'data', 'leads.json'), 'utf8'));
const outputPath = path.join(root, 'data', 'pipeline-dry-run-report.json');
const seen = new Map();
const errors = [];
const records = source.map((lead, index) => {
  const normalizedPhone = normalizeE164(lead.phone);
  const normalizedBusinessKey = `${String(lead.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} ${String(lead.location || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`.trim();
  const duplicateOf = seen.get(normalizedBusinessKey) || null;
  if (!duplicateOf) seen.set(normalizedBusinessKey, lead.id);
  const score = scoreLead(lead);
  const productFits = matchProducts(lead);
  const offer = fallbackMessage(lead, productFits[0]);
  const route = routeSms(normalizedPhone);
  const preparedSms = smsOpener(lead, productFits[0]?.product);
  const eligibility = smsEligibility({ ...lead, sms_approval_state: 'PENDING', consent_status: 'NOT_ESTABLISHED', sms_message: preparedSms });
  if (!lead.name || !normalizedPhone || !productFits.length || !offer.body) errors.push({ lead_id: lead.id, reason: 'missing deterministic pipeline output' });
  return {
    sequence: index + 1,
    lead_id: lead.id,
    business: lead.name,
    normalized_business_key: normalizedBusinessKey,
    duplicate_of: duplicateOf,
    phone: normalizedPhone,
    phone_route: route,
    website_status: lead.website ? 'PENDING_VERIFICATION' : 'UNKNOWN',
    score,
    product_fits: productFits,
    selected_product: productFits[0]?.product || null,
    fallback_offer: offer,
    sms_message_prepared: Boolean(preparedSms),
    sms_eligibility: eligibility,
    send_status: eligibility.eligible ? 'ELIGIBLE_AFTER_GATES' : 'BLOCKED_REVIEW_ONLY',
    outbound_called: false,
  };
});

const count = (predicate) => records.filter(predicate).length;
const report = {
  run_type: 'CAP_V0.1_100_LEAD_NO_SEND_DRY_RUN',
  generated_at: new Date().toISOString(),
  source_count: source.length,
  unique_count: new Set(records.map((record) => record.normalized_business_key)).size,
  duplicate_count: count((record) => Boolean(record.duplicate_of)),
  website_status_counts: Object.fromEntries([...new Set(records.map((record) => record.website_status))].map((status) => [status, count((record) => record.website_status === status)])),
  sms_route_counts: Object.fromEntries([...new Set(records.map((record) => record.phone_route.provider || 'none'))].map((provider) => [provider, count((record) => (record.phone_route.provider || 'none') === provider)])),
  qualified_count: count((record) => record.score.total >= 60),
  messages_prepared: count((record) => record.sms_message_prepared && Boolean(record.fallback_offer?.body)),
  send_eligible_count: count((record) => record.sms_eligibility.eligible),
  blocked_review_only_count: count((record) => record.send_status === 'BLOCKED_REVIEW_ONLY'),
  outbound_calls: 0,
  errors,
  records,
  safety: {
    provider_calls_made: false,
    outbound_messages_sent: false,
    approval_bypassed: false,
    permission_basis_assumed: false,
    note: 'This report is a deterministic local dry run. Website network checks, Hunter, Twilio, SES, OpenAI, n8n, database writes, and queue writes are not called.'
  }
};

fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ok: errors.length === 0 && report.source_count === 100 && report.unique_count === 100 && report.outbound_calls === 0, output: path.relative(root, outputPath), source_count: report.source_count, unique_count: report.unique_count, qualified_count: report.qualified_count, messages_prepared: report.messages_prepared, send_eligible_count: report.send_eligible_count, errors: errors.length }, null, 2));
if (errors.length || report.source_count !== 100 || report.unique_count !== 100 || report.outbound_calls !== 0) process.exitCode = 1;
