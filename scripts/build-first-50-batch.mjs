import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'data', 'activation-manifest.json'), 'utf8'));
const records = source.records.filter((record) => record.channel === 'SMS_US').slice(0, 50).map((record, index) => ({
  batch_position: index + 1,
  lead_id: record.lead_id,
  business: record.business,
  phone: record.phone,
  provider: 'twilio',
  message: record.sms_message,
  permission_basis: 'NOT_ESTABLISHED',
  operator_approval: 'PENDING',
  suppression_check: 'REQUIRED_AT_SEND',
  send_status: 'BLOCKED_REVIEW_ONLY',
  blocker: 'No permission/compliance basis is present in the supplied PDF; operator review and documented lawful outreach basis are required before sending.',
}));
const output = { generated_at: new Date().toISOString(), campaign: source.campaign, batch_size: records.length, channel: 'SMS_US', provider: 'twilio', send_enabled: false, records };
fs.writeFileSync(path.join(root, 'data', 'first-50-sms-batch.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ ok: true, batch_size: records.length, send_enabled: output.send_enabled, permission_basis: 'NOT_ESTABLISHED', operator_approval: 'PENDING' }, null, 2));
