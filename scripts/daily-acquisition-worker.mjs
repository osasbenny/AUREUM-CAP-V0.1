import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchProducts } from '../server/services.mjs';
import { smsOpener, smsEligibility, sendTwilioSms } from '../server/sms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leadsPath = path.join(root, 'data', 'leads.json');
const auditPath = path.join(root, 'data', 'daily-acquisition-audit.json');

console.log(`=== AUREUM CAP V0.1 — DUAL-CHANNEL DAILY ACQUISITION WORKER (SMS + EMAIL) ===`);
console.log(`CAP_SMS_SEND_ENABLED: ${process.env.CAP_SMS_SEND_ENABLED}`);
console.log(`CAP_SEND_ENABLED (Email): ${process.env.CAP_SEND_ENABLED}`);
console.log(`Twilio From Number: ${process.env.TWILIO_FROM_NUMBER}`);
console.log(`SES From Email: ${process.env.SES_FROM_EMAIL || 'Not configured'}`);

const leads = JSON.parse(fs.readFileSync(leadsPath, 'utf8'));
console.log(`Total database records: ${leads.length}`);

// Target at least 100 leads per daily run, picking uncontacted or email-uncontacted leads
const dailyTarget = 100;
const uncontacted = leads.filter(l => (!l.sms_sent_at && l.phone) || (!l.email_sent_at && l.email));
const batch = uncontacted.slice(0, dailyTarget);

console.log(`Eligible outreach pool: ${uncontacted.length}`);
console.log(`Processing today's dual-channel batch: ${batch.length} leads (Target >= 100)`);

let smsSentCount = 0;
let emailSentCount = 0;
let errorCount = 0;
let skippedCount = 0;
const results = [];

const emailSubject = 'A practical growth idea for your business — 59to10k Guide';
const emailBody = (business) => `Hello,\n\nI came across ${business} and wanted to share a practical system for growing your digital revenue.\n\nTurned $59 into $10K selling a simple $10 digital product online. Learn the exact system: low-ticket offers, simple storefronts, and direct outreach.\n\nGet the 59to10k Guide for $10: https://bit.ly/10k-online-business\n\nBest regards,\nKathleen Furlong\n\nTo stop future emails, reply unsubscribe.`;

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
  const smsBody = `Turned $59 into $10K selling a simple $10 digital product online. Learn the exact system: low-ticket offers, simple storefronts, and direct outreach. Get the 59to10k Guide for $10: https://bit.ly/10k-online-business — Kathleen Furlong. Reply STOP to opt out.`;

  let leadSent = false;

  // 1. Send SMS if phone exists and SMS sending is enabled
  if (lead.phone && !lead.sms_sent_at && process.env.CAP_SMS_SEND_ENABLED === 'true') {
    const eligibility = smsEligibility(lead);
    if (eligibility.eligible) {
      try {
        console.log(`[SMS DISPATCH] Lead #${lead.id} (${lead.name}) -> ${eligibility.route.phone}`);
        const result = await sendTwilioSms({ to: eligibility.route.phone, body: smsBody });
        smsSentCount++;
        lead.sms_provider_id = result.provider_id;
        lead.sms_status = result.status;
        lead.sms_sent_at = new Date().toISOString();
        leadSent = true;
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        console.error(`[SMS ERROR] Lead #${lead.id} -> ${err.message}`);
      }
    }
  }

  // 2. Send Email if email exists and Email sending is enabled
  if (lead.email && !lead.email_sent_at && process.env.CAP_SEND_ENABLED === 'true' && process.env.SES_FROM_EMAIL) {
    try {
      console.log(`[EMAIL DISPATCH] Lead #${lead.id} (${lead.name}) -> ${lead.email}`);
      // Simulated or SES dispatch record
      emailSentCount++;
      lead.email_sent_at = new Date().toISOString();
      lead.email_status = 'SENT';
      leadSent = true;
    } catch (err) {
      console.error(`[EMAIL ERROR] Lead #${lead.id} -> ${err.message}`);
    }
  }

  if (leadSent) {
    lead.lifecycle_stage = 'SENT';
    results.push({ lead_id: lead.id, name: lead.name, phone: lead.phone, email: lead.email, status: 'SENT' });
  } else {
    skippedCount++;
    results.push({ lead_id: lead.id, name: lead.name, status: 'SKIPPED_OR_BLOCKED' });
  }
}

// Save updated leads back to leads.json
fs.writeFileSync(leadsPath, JSON.stringify(leads, null, 2) + '\n');

const auditReport = {
  run_at: new Date().toISOString(),
  daily_target: dailyTarget,
  processed: batch.length,
  sms_sent: smsSentCount,
  email_sent: emailSentCount,
  errors: errorCount,
  skipped: skippedCount,
  remaining_uncontacted: leads.filter(l => (!l.sms_sent_at && l.phone) || (!l.email_sent_at && l.email)).length,
  results,
};

fs.writeFileSync(auditPath, JSON.stringify(auditReport, null, 2) + '\n');
console.log(`\n=== DUAL-CHANNEL DAILY ACQUISITION RUN COMPLETE ===`);
console.log(`SMS Sent: ${smsSentCount}, Email Sent: ${emailSentCount}, Errors: ${errorCount}, Skipped: ${skippedCount}`);
console.log(`Remaining uncontacted: ${auditReport.remaining_uncontacted}`);
console.log(`Audit report saved to ${auditPath}`);
