import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchProducts } from '../server/services.mjs';
import { routeSms, smsOpener } from '../server/sms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leadsPath = path.join(root, 'data', 'leads.json');
const leads = JSON.parse(fs.readFileSync(leadsPath, 'utf8'));

const batch2 = leads.slice(50, 100);
console.log(`=== BATCH 2 (LEADS 51-100) — PHONE NUMBERS & MESSAGE VERIFICATION ===\n`);

batch2.forEach((lead, index) => {
  const productFit = matchProducts(lead)[0]?.product;
  const message = smsOpener(lead, productFit);
  const route = routeSms(lead.phone);
  console.log(`${index + 51}. [Lead #${lead.id}] ${lead.name}`);
  console.log(`   - Category: ${lead.category}`);
  console.log(`   - Phone (E.164): ${route.phone || lead.phone} (Route: ${route.provider})`);
  console.log(`   - Message Opener:\n     "${message}"\n`);
});
