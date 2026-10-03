import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leads = JSON.parse(fs.readFileSync(path.join(root, 'data', 'leads.json'), 'utf8'));
const failures = [];
const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const domain = (value) => norm(String(value || '').replace(/^https?:\/\//, '').split('/')[0].replace(/^www/, ''));
const email = (value) => String(value || '').trim().toLowerCase();
const phone = (value) => String(value || '').replace(/\D/g, '');
const identity = (lead) => domain(lead.website) ? `domain:${domain(lead.website)}` : email(lead.email) ? `email:${email(lead.email)}` : phone(lead.phone) ? `phone:${phone(lead.phone)}` : `company:${norm(lead.name)}|${norm(lead.location)}`;
if (leads.length < 682) failures.push(`expected at least 682 source prospects, found ${leads.length}`);
const ids = leads.map((lead) => lead.id);
if (new Set(ids).size !== ids.length) failures.push('lead IDs are not unique');
if (ids.some((id) => !Number.isInteger(id) || id < 1)) failures.push('lead IDs must be positive integers');
const duplicateKeys = [...new Set(leads.map(identity).filter((key, index, all) => all.indexOf(key) !== index))];
for (const lead of leads) {
  if (!lead.name || !lead.category) failures.push(`invalid required fields for lead ${lead.id}`);
  if (lead.phone && !/^\+?\d{10,15}$/.test(String(lead.phone).replace(/\s/g, ''))) failures.push(`invalid phone for lead ${lead.id}`);
  if (lead.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) failures.push(`invalid email for lead ${lead.id}`);
}
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(JSON.stringify({ ok: true, leads: leads.length, normalized_identities: new Set(leads.map(identity)).size, source_duplicates_to_reconcile: duplicateKeys.length, high_intent: leads.filter((lead) => lead.request_type || /request|rfi|redesign/i.test(String(lead.stage || ''))).length }));
