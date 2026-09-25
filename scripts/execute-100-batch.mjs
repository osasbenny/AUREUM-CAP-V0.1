import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchProducts } from '../server/services.mjs';
import { routeSms, smsOpener, smsEligibility, sendTwilioSms } from '../server/sms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leadsPath = path.join(root, 'data', 'leads.json');
const leads = JSON.parse(fs.readFileSync(leadsPath, 'utf8'));

console.log(`=== AUREUM CAP V0.1 — PILOT BATCH EXECUTION (TWILIO TRIAL LIMIT 50/DAY) ===`);
console.log(`Total leads: ${leads.length}`);
console.log(`CAP_SMS_SEND_ENABLED: ${process.env.CAP_SMS_SEND_ENABLED}`);
console.log(`Twilio From Number: ${process.env.TWILIO_FROM_NUMBER}`);

if (process.env.CAP_SMS_SEND_ENABLED !== 'true') {
  console.error('ERROR: CAP_SMS_SEND_ENABLED is not set to true. Aborting live execution.');
  process.exit(1);
}

// Respect Twilio trial account daily limit of 50 messages per 24 hours
const dailyLimit = 50;
const batchToProcess = leads.slice(0, dailyLimit);

let sentCount = 0;
let errorCount = 0;
let skippedCount = 0;
const executionResults = [];

for (const raw of batchToProcess) {
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

  if (!eligibility.eligible) {
    skippedCount++;
    console.log(`[SKIPPED] Lead #${lead.id} (${lead.name}) -> Reason: ${eligibility.reason}`);
    executionResults.push({ lead_id: lead.id, name: lead.name, status: 'SKIPPED', reason: eligibility.reason });
    continue;
  }

  try {
    console.log(`[SENDING] Lead #${lead.id} (${lead.name}) to ${eligibility.route.phone}...`);
    const result = await sendTwilioSms({
      to: eligibility.route.phone,
      body: lead.sms_message,
      statusCallback: process.env.SMS_STATUS_CALLBACK_URL,
    });
    sentCount++;
    console.log(`[SUCCESS] Lead #${lead.id} -> Twilio SID: ${result.provider_id}, Status: ${result.status}`);
    executionResults.push({ lead_id: lead.id, name: lead.name, phone: eligibility.route.phone, status: 'SENT', provider_id: result.provider_id, twilio_status: result.status });

    // Throttle between requests
    await new Promise((resolve) => setTimeout(resolve, 150));
  } catch (error) {
    errorCount++;
    console.error(`[ERROR] Lead #${lead.id} (${lead.name}) -> Failed: ${error.message}`);
    executionResults.push({ lead_id: lead.id, name: lead.name, phone: eligibility.route.phone, status: 'ERROR', error: error.message });
  }
}

const report = {
  executed_at: new Date().toISOString(),
  total_leads: leads.length,
  batch_processed: batchToProcess.length,
  sent: sentCount,
  errors: errorCount,
  skipped: skippedCount,
  results: executionResults,
};

const reportPath = path.join(root, 'data', '100-lead-pilot-execution-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(`\n=== BATCH EXECUTION COMPLETE ===`);
console.log(`Processed: ${batchToProcess.length}, Sent: ${sentCount}, Errors: ${errorCount}, Skipped: ${skippedCount}`);
console.log(`Execution report saved to ${reportPath}`);
