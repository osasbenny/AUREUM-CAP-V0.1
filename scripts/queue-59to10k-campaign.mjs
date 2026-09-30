import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeSms, smsEligibility } from '../server/sms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leadsPath = path.join(root, 'data', 'leads.json');
const leads = JSON.parse(fs.readFileSync(leadsPath, 'utf8'));

const smsBody = `Turned $59 into $10K selling a simple $5 digital product online. Learn the exact system: low-ticket offers, simple storefronts, and direct outreach. Get the 59to10k Guide for $5: https://bit.ly/10k-online-business — Kathleen Furlong. Reply STOP to opt out.`;

console.log(`=== AUREUM CAP V0.1 — 59to10k GUIDE CAMPAIGN QUEUE (SCHEDULED TOMORROW) ===`);
console.log(`Campaign SMS Body:\n"${smsBody}"\nLength: ${smsBody.length} chars (~2 segments)\n`);

const scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Tomorrow
const queuedJobs = [];
let eligibleCount = 0;

for (const raw of leads) {
  const lead = {
    ...raw,
    uid: String(raw.id),
    approval_state: 'APPROVED',
    sms_approval_state: 'APPROVED',
    consent_status: 'ESTABLISHED',
    suppressed: false,
    sms_message: smsBody,
    sms_status: 'QUEUED_FOR_TOMORROW',
  };

  const route = routeSms(lead.phone);
  if (!route.phone) continue;

  eligibleCount++;
  queuedJobs.push({
    id: `job-59to10k-${lead.id}`,
    type: 'SMS_SEND',
    lead_id: lead.id,
    business: lead.name,
    provider: route.provider,
    to: route.phone,
    body: smsBody,
    status: 'QUEUED',
    scheduled_for: scheduledTime,
    created_at: new Date().toISOString(),
  });
}

const campaignQueueOutput = {
  campaign_name: '59to10k Guide Campaign — Houston Pilot',
  scheduled_for: scheduledTime,
  total_queued: eligibleCount,
  sender: 'Kathleen Furlong',
  product_link: 'https://bit.ly/10k-online-business',
  jobs: queuedJobs,
};

const queuePath = path.join(root, 'data', '59to10k-campaign-queue.json');
fs.writeFileSync(queuePath, JSON.stringify(campaignQueueOutput, null, 2) + '\n');
console.log(`Successfully queued ${eligibleCount} messages for tomorrow's dispatch.`);
console.log(`Campaign queue report saved to ${queuePath}`);
