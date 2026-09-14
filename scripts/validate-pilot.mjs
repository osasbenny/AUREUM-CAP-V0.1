import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leads = JSON.parse(fs.readFileSync(path.join(root, 'data', 'leads.json'), 'utf8'));
const failures = [];
const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const keyFor = (lead) => `${normalize(lead.name)}|${normalize(lead.phone)}`;

if (leads.length !== 100) failures.push(`expected 100 leads, found ${leads.length}`);
const ids = leads.map((lead) => lead.id);
if (new Set(ids).size !== ids.length) failures.push('lead IDs are not unique');
if (ids.some((id) => !Number.isInteger(id) || id < 1)) failures.push('lead IDs must be positive integers');
const duplicateKeys = [...new Set(leads.map(keyFor).filter((key, index, all) => all.indexOf(key) !== index))];
if (duplicateKeys.length) failures.push(`duplicate business keys: ${duplicateKeys.join(', ')}`);
for (const lead of leads) {
  if (!lead.name || !lead.category || !lead.phone || lead.stage !== 'IMPORTED') {
    failures.push(`invalid required fields for lead ${lead.id}`);
  }
  if (!/^\+\d{10,15}$/.test(lead.phone)) failures.push(`invalid E.164-like phone for lead ${lead.id}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, leads: leads.length, unique_business_keys: leads.length }));
