import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreLead, matchProducts, fallbackMessage, normalizeKey } from '../server/services.mjs';
import { routeSms, smsOpener } from '../server/sms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leads = JSON.parse(fs.readFileSync(path.join(root, 'data', 'leads.json'), 'utf8'));
const seen = new Map();
const manifest = leads.map((lead) => {
  const key = normalizeKey(`${lead.name} ${lead.location} ${lead.phone}`);
  const duplicate_of = seen.get(key) || null;
  if (!duplicate_of) seen.set(key, lead.id);
  const score = scoreLead(lead);
  const product_fits = matchProducts(lead);
  const offer = fallbackMessage(lead, product_fits[0]);
  const sms_route = routeSms(lead.phone);
  return {
    lead_id: lead.id,
    business: lead.name,
    category: lead.category,
    location: lead.location,
    phone: lead.phone,
    source: '100LEADSOFDAYO1(1).pdf',
    normalized_business_key: key,
    duplicate_of,
    website: null,
    website_status: 'UNKNOWN',
    email: null,
    email_status: 'NOT_SUPPLIED',
    email_source: null,
    consent_status: 'NOT_ESTABLISHED',
    enrichment_status: 'REQUIRED',
    score,
    product_fits,
    selected_product: product_fits[0]?.product || null,
    offer,
    sms_route,
    sms_message: smsOpener(lead, product_fits[0]?.product),
    sms_status: 'PREPARED_FOR_REVIEW',
    lifecycle: 'IMPORTED',
    channel: sms_route.provider === 'twilio' ? 'SMS_US' : sms_route.provider === 'termii' ? 'SMS_AFRICA' : 'UNROUTABLE',
    send_eligibility: 'BLOCKED_APPROVAL_AND_PERMISSION_BASIS',
    blocker: 'Phone routing is available, but explicit operator approval, permission/compliance basis, suppression checks, and provider configuration are required before sending.',
  };
});
const duplicates = manifest.filter((x) => x.duplicate_of).length;
const output = {
  generated_at: new Date().toISOString(),
  campaign: 'CAP V0.1 — Campaign 001 — Houston Website Opportunity',
  source_count: leads.length,
  unique_count: leads.length - duplicates,
  duplicate_count: duplicates,
  email_count: manifest.filter((x) => x.email).length,
  verified_email_count: manifest.filter((x) => x.email_status === 'VERIFIED').length,
  sendable_count: manifest.filter((x) => x.send_eligibility === 'ELIGIBLE').length,
  provider_blocker: 'Email is unavailable in the source PDF; the activation channel is SMS. U.S. +1 numbers route to Twilio by default; non-U.S. numbers route to Termii. No message is sendable without approval and a documented permission/compliance basis.',
  records: manifest,
};
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data', 'activation-manifest.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, source_count: output.source_count, unique_count: output.unique_count, duplicates: output.duplicate_count, emails: output.email_count, verified_emails: output.verified_email_count, sendable: output.sendable_count }, null, 2));
