import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'data', 'activation-manifest.json');
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const records = manifest.records;
const errors = [];
if (manifest.source_count !== 100 || records.length !== 100) errors.push('activation manifest must contain exactly 100 source records');
const ids = new Set(records.map((r) => r.lead_id));
if (ids.size !== records.length) errors.push('lead IDs must be unique');
for (const record of records) {
  if (!record.business || !record.phone) errors.push(`lead ${record.lead_id} missing source identity`);
  if (!record.email && record.send_eligibility === 'ELIGIBLE') errors.push(`lead ${record.lead_id} is sendable without an email`);
  if (record.email && record.email_status !== 'VERIFIED') errors.push(`lead ${record.lead_id} has unverified email marked sendable`);
  if (!record.offer?.approval_required) errors.push(`lead ${record.lead_id} missing approval-gated offer`);
}
if (errors.length) { console.error(JSON.stringify({ ok: false, errors }, null, 2)); process.exit(1); }
console.log(JSON.stringify({ ok: true, records: records.length, duplicates: manifest.duplicate_count, emails: manifest.email_count, verified_emails: manifest.verified_email_count, sendable: manifest.sendable_count, provider_blocker: manifest.provider_blocker }, null, 2));
