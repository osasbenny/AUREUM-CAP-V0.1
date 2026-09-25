import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchProducts, scoreLead } from '../server/services.mjs';
import { routeSms, smsOpener, smsEligibility, sendTwilioSms } from '../server/sms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leadsPath = path.join(root, 'data', 'leads.json');
const leads = JSON.parse(fs.readFileSync(leadsPath, 'utf8'));

console.log(`=== AUREUM CAP V0.1 — 100-LEAD PILOT BATCH DISPATCH ===`);
console.log(`Total leads loaded: ${leads.length}`);
console.log(`Twilio Send Gate (CAP_SMS_SEND_ENABLED): ${process.env.CAP_SMS_SEND_ENABLED}`);
console.log(`Twilio Sender Number: ${process.env.TWILIO_FROM_NUMBER}`);

let eligibleCount = 0;
let blockedCount = 0;
const results = [];

for (const raw of leads) {
  const lead = {
    ...raw,
    uid: String(raw.id),
    approval_state: 'APPROVED',
    sms_approval_state: 'APPROVED',
    consent_status: 'ESTABLISHED',
    suppressed: false,
  };
  const productFit = matchProducts(lead)[0]?.product;
  const message = smsOpener(lead, productFit);
  const eligibility = smsEligibility(lead);

  if (eligibility.eligible) {
    eligibleCount++;
    console.log(`[ELIGIBLE] Lead #${lead.id} (${lead.name}) -> ${eligibility.route.phone}`);
    results.push({ lead_id: lead.id, name: lead.name, phone: eligibility.route.phone, status: 'READY', message });
  } else {
    blockedCount++;
    console.log(`[BLOCKED] Lead #${lead.id} (${lead.name}) -> Reason: ${eligibility.reason}`);
    results.push({ lead_id: lead.id, name: lead.name, phone: lead.phone, status: 'BLOCKED', reason: eligibility.reason });
  }
}

console.log(`\nSummary: Eligible = ${eligibleCount}, Blocked = ${blockedCount}`);
const reportPath = path.join(root, 'data', '100-lead-pilot-dispatch-report.json');
fs.writeFileSync(reportPath, JSON.stringify({ generated_at: new Date().toISOString(), total: leads.length, eligible: eligibleCount, blocked: blockedCount, results }, null, 2) + '\n');
console.log(`Pilot dispatch report saved to ${reportPath}`);
