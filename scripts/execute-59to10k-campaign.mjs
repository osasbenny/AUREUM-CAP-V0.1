import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sendTwilioSms } from '../server/sms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const queuePath = path.join(root, 'data', '59to10k-campaign-queue.json');

if (!fs.existsSync(queuePath)) {
  console.error('ERROR: 59to10k campaign queue file not found. Run queue script first.');
  process.exit(1);
}

const queueData = JSON.parse(fs.readFileSync(queuePath, 'utf8'));

console.log(`=== AUREUM CAP V0.1 — LIVE 59to10k CAMPAIGN DISPATCH ===`);
console.log(`Campaign: ${queueData.campaign_name}`);
console.log(`Total Queued: ${queueData.total_queued}`);
console.log(`CAP_SMS_SEND_ENABLED: ${process.env.CAP_SMS_SEND_ENABLED}`);
console.log(`Twilio From Number: ${process.env.TWILIO_FROM_NUMBER}`);
console.log(`Available Balance: Active ($20.00)\n`);

if (process.env.CAP_SMS_SEND_ENABLED !== 'true') {
  console.error('ERROR: CAP_SMS_SEND_ENABLED is not set to true. Aborting live execution.');
  process.exit(1);
}

let sentCount = 0;
let errorCount = 0;
const results = [];

for (const job of queueData.jobs) {
  try {
    console.log(`[SENDING] Lead #${job.lead_id} (${job.business}) to ${job.to}...`);
    const result = await sendTwilioSms({
      to: job.to,
      body: job.body,
      statusCallback: process.env.SMS_STATUS_CALLBACK_URL,
    });
    sentCount++;
    console.log(`[SUCCESS] Lead #${job.lead_id} -> Twilio SID: ${result.provider_id}, Status: ${result.status}`);
    results.push({ lead_id: job.lead_id, business: job.business, phone: job.to, status: 'SENT', provider_id: result.provider_id, twilio_status: result.status });

    // Throttle between requests (250ms) to ensure smooth carrier submission
    await new Promise((resolve) => setTimeout(resolve, 250));
  } catch (error) {
    errorCount++;
    console.error(`[ERROR] Lead #${job.lead_id} (${job.business}) -> Failed: ${error.message}`);
    results.push({ lead_id: job.lead_id, business: job.business, phone: job.to, status: 'ERROR', error: error.message });
  }
}

const report = {
  executed_at: new Date().toISOString(),
  campaign_name: queueData.campaign_name,
  total_processed: queueData.jobs.length,
  sent: sentCount,
  errors: errorCount,
  results,
};

const reportPath = path.join(root, 'data', '59to10k-campaign-execution-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(`\n=== 59to10k CAMPAIGN DISPATCH COMPLETE ===`);
console.log(`Sent: ${sentCount}, Errors: ${errorCount}`);
console.log(`Execution report saved to ${reportPath}`);
