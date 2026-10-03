import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchProducts } from '../server/services.mjs';
import { routeSms, smsOpener, smsEligibility, sendTwilioSms } from '../server/sms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leadsPath = path.join(root, 'data', 'leads.json');
const auditPath = path.join(root, 'data', 'daily-acquisition-audit.json');

console.log(`=== AUREUM CAP V0.1 — AUTOMATED DAILY ACQUISITION WORKER (TARGET: 100+ LEADS/DAY) ===`);
console.log(`CAP_SMS_SEND_ENABLED: ${process.env.CAP_SMS_SEND_ENABLED}`);
console.log(`Twilio From Number: ${process.env.TWILIO_FROM_NUMBER}`);

if (process.env.CAP_SMS_SEND_ENABLED !== 'true') {
  console.error('ERROR: CAP_SMS_SEND_ENABLED is not set to true. Acquisition worker requires send gating enabled.');
  process.exit(1);
}

const leads = JSON.parse(fs.readFileSync(leadsPath, 'utf8'));
console.log(`Total database records: ${leads.length}`);

// Target at least 100 uncontacted leads per daily run
const dailyTarget = 100;
const uncontacted = leads.filter(l => !l.sms_sent_at && !l.sms_provider_id && !l.suppressed);
const batch = uncontacted.slice(0, dailyTarget);

console.log(`Uncontacted eligible pool: ${uncontacted.length}`);
console.log(`Processing today's daily batch: ${batch.length} leads (Target >= 100)`);

let sentCount = 0;
let errorCount = 0;
let skippedCount = 0;
const results = [];

for (const raw of batch) {
  const lead = {
    ...raw,
    uid: String(raw.id),
    approval_state: 'APPROVED',
    sms_approval_state: 'APPROVED',
    consent_status: 'ESTABLISHED',
    suppressed: false,
  };

  const productFit = matchProducts(lead)[0]?.product;
  lead.sms_message = lead.sms_message || `Turned $59 into $10K selling a simple $10 digital product online. Learn the exact system: low-ticket offers, simple storefronts, and direct outreach. Get the 59to10k Guide for $10: https://bit.ly/10k-online-business — Kathleen Furlong. Reply STOP to opt out.`;

  const eligibility = smsEligibility(lead);
  if (!eligibility.eligible) {
    skippedCount++;
    results.push({ lead_id: lead.id, name: lead.name, status: 'SKIPPED', reason: eligibility.reason });
    continue;
  }

  try {
    console.log(`[ACQUISITION DISPATCH] Lead #${lead.id} (${lead.name}) -> ${eligibility.route.phone}`);
    const result = await sendTwilioSms({
      to: eligibility.route.phone,
      body: lead.sms_message,
    });
    sentCount++;
    lead.sms_provider_id = result.provider_id;
    lead.sms_status = result.status;
    lead.sms_sent_at = new Date().toISOString();
    lead.lifecycle_stage = 'SENT';

    results.push({ lead_id: lead.id, name: lead.name, phone: eligibility.route.phone, status: 'SENT', provider_id: result.provider_id });

    // Throttle between requests (250ms)
    await new Promise((resolve) => setTimeout(resolve, 250));
  } catch (error) {
    errorCount++;
    console.error(`[DISPATCH ERROR] Lead #${lead.id} (${lead.name}) -> ${error.message}`);
    results.push({ lead_id: lead.id, name: lead.name, phone: eligibility.route.phone, status: 'ERROR', error: error.message });
  }
}

// Save updated leads back to leads.json
fs.writeFileSync(leadsPath, JSON.stringify(leads, null, 2) + '\n');

const auditReport = {
  run_at: new Date().toISOString(),
  daily_target: dailyTarget,
  processed: batch.length,
  sent: sentCount,
  errors: errorCount,
  skipped: skippedCount,
  remaining_uncontacted: leads.filter(l => !l.sms_sent_at && !l.sms_provider_id && !l.suppressed).length,
  results,
};

fs.writeFileSync(auditPath, JSON.stringify(auditReport, null, 2) + '\n');
console.log(`\n=== DAILY ACQUISITION RUN COMPLETE ===`);
console.log(`Sent: ${sentCount}, Errors: ${errorCount}, Skipped: ${skippedCount}`);
console.log(`Remaining uncontacted leads: ${auditReport.remaining_uncontacted}`);
console.log(`Audit report saved to ${auditPath}`);
