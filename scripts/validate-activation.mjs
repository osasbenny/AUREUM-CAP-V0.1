import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'activation-manifest.json'), 'utf8'));
const records = manifest.records || [];
const errors = [];
if (manifest.source_count < 682 || records.length < 682) errors.push(`activation manifest must contain the full production corpus; found ${records.length}`);
if (new Set(records.map((r) => r.lead_id)).size !== records.length) errors.push('lead IDs must be unique');
for (const record of records) {
  if (!record.business) errors.push(`lead ${record.lead_id} missing business identity`);
  if (record.send_eligibility === 'ELIGIBLE') errors.push(`lead ${record.lead_id} is incorrectly marked sendable in a fixture manifest`);
  if (record.email && record.email_status === 'VERIFIED' && !record.email_source) errors.push(`lead ${record.lead_id} verified email missing source evidence`);
  if (!record.offer?.approval_required) errors.push(`lead ${record.lead_id} missing approval-gated offer`);
}
if (errors.length) { console.error(JSON.stringify({ ok: false, errors: errors.slice(0, 50) }, null, 2)); process.exit(1); }
console.log(JSON.stringify({ ok: true, records: records.length, duplicates: manifest.duplicate_count, emails: manifest.email_count, verified_emails: manifest.verified_email_count, sendable: manifest.sendable_count, acquisition_target: manifest.acquisition_target, email_outreach_limit: manifest.email_outreach_limit }, null, 2));
