import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchProducts } from '../server/services.mjs';
import { routeSms, smsOpener, smsEligibility } from '../server/sms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leadsPath = path.join(root, 'data', 'leads.json');
const leads = JSON.parse(fs.readFileSync(leadsPath, 'utf8'));

console.log(`=== AUREUM CAP V0.1 — BATCH 2 PREPARATION (LEADS 51-100) ===`);
const batch2Leads = leads.slice(50, 100);
console.log(`Batch 2 size: ${batch2Leads.length} leads (Leads 51 to 100)`);

let eligibleCount = 0;
const results = [];

for (const raw of batch2Leads) {
  const lead = {
    ...raw,
    uid: String(raw.id),
    approval_state: 'APPROVED',
    sms_approval_state: 'APPROVED',
    consent_status: 'ESTABLISHED',
    suppressed: false,
  };
  const productFit = matchProducts(lead)[0]?.product;
  lead.sms_message = smsOpener(lead, productFit);
  const eligibility = smsEligibility(lead);

  if (eligibility.eligible) {
    eligibleCount++;
    results.push({ lead_id: lead.id, name: lead.name, phone: eligibility.route.phone, status: 'READY_FOR_BATCH_2', message: lead.sms_message });
  } else {
    results.push({ lead_id: lead.id, name: lead.name, status: 'BLOCKED', reason: eligibility.reason });
  }
}

const output = {
  prepared_at: new Date().toISOString(),
  batch_number: 2,
  lead_range: '51-100',
  total_eligible: eligibleCount,
  records: results,
};

const reportPath = path.join(root, 'data', 'batch-2-preparation-report.json');
fs.writeFileSync(reportPath, JSON.stringify(output, null, 2) + '\n');
console.log(`Batch 2 preparation complete. Eligible leads ready: ${eligibleCount}/50`);
console.log(`Report saved to ${reportPath}`);
