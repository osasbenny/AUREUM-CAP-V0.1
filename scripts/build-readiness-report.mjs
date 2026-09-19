import fs from 'node:fs';

const leads = JSON.parse(fs.readFileSync('data/leads.json', 'utf8'));
const dryRun = JSON.parse(fs.readFileSync('data/pipeline-dry-run-report.json', 'utf8'));
const byId = new Map(dryRun.records.map((r) => [String(r.lead_id), r]));

const cleanLocation = (value) => String(value || '').replace(/^LOCATION:\s*/i, '').replace(/\.\s*PHONE NUMBER:\s*$/i, '').trim();
const esc = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', '<br>');
const shortlist = leads
  .filter((l) => l.category === 'Car Wash')
  .sort((a, b) => Number(a.id) - Number(b.id))
  .slice(0, 10);

const rows = leads.map((lead) => {
  const run = byId.get(String(lead.id));
  const opportunity = lead.category === 'Car Wash'
    ? 'Hypothesis to validate: improve local discovery, service presentation, and booking/contact conversion with a purpose-built website.'
    : lead.category === 'Roofing'
      ? 'Hypothesis to validate: improve local-service discovery, trust presentation, quote-request conversion, and follow-up with a purpose-built website or automation.'
      : 'Hypothesis to validate: improve local discovery, service presentation, and quote/contact conversion with a purpose-built website.';
  const offer = 'Proposal only: Premium Website Development; indicative scope/price for discussion: $1,500–$4,000 depending on audit findings and requirements.';
  return {
    id: lead.id,
    business: lead.name,
    website: 'Not supplied; source marks website as Unverified',
    source: 'Seeded 100-lead manifest imported from supplied source PDF; no independent website audit completed',
    category: lead.category,
    contact: `${lead.phone} (phone listed in manifest; no named person or verified role)`,
    missing: 'Named decision-maker, verified website, verified email, contact-source evidence, lawful contact basis, channel-specific permission, suppression/opt-out history, operating details, budget, timeline, and requirements.',
    opportunity,
    fit: `${run?.selected_product || 'Premium Website Development'} is a provisional deterministic fit only; evidence is limited to category, Houston location, phone presence, and unverified website status.`,
    offer,
    channel: 'Phone/SMS technically routed to Twilio by number format; no email available.',
    eligibility: 'Not eligible for outreach: no documented permission/lawful basis, no suppression review evidence, no verified recipient identity, and SMS gate is disabled.',
    suppression: 'Not evidenced in source manifest; suppression status must be checked against authoritative CAP suppression records before any contact.',
    confidence: 'Low-to-moderate for category/location/phone presence; low for need, decision-maker, website condition, and buying context.',
    readiness: 'C — Needs contact-permission or compliance review (also requires additional research).',
    blocker: 'Documented lawful basis and channel eligibility are absent; website, email, decision-maker, suppression, and business-needs research are incomplete.',
    score: run?.score?.total ?? null,
    productScore: run?.product_fits?.[0]?.score ?? null,
  };
});

const counts = rows.reduce((a, r) => { const k = r.readiness[0]; a[k] = (a[k] || 0) + 1; return a; }, {});
const lines = [];
lines.push('# CAP V0.1 — 100-Lead Readiness and Qualified Outreach Report');
lines.push('');
lines.push('## Executive conclusion');
lines.push('');
lines.push('The 100-record manifest has been processed deterministically. All 100 records are unique and all 100 have a phone number, but none has a verified email, verified website, named decision-maker, documented contact permission, or completed suppression evidence in the source data. Therefore, **zero records are currently eligible for outreach**. Every record is placed in the primary category **C — Needs contact-permission or compliance review**, with additional research required. No message should be sent, and no SMS should be activated.');
lines.push('');
lines.push('## 1. Readiness totals');
lines.push('');
lines.push('| Category | Count | Meaning |');
lines.push('|---|---:|---|');
lines.push(`| A. Ready for human-approved outreach | ${counts.A || 0} | No record meets the evidence threshold. |`);
lines.push(`| B. Needs additional research | ${counts.B || 0} | No record is assigned exclusively to B; research gaps are present across all C records. |`);
lines.push(`| C. Needs contact-permission or compliance review | ${counts.C || 0} | Phone presence does not establish permission to send marketing SMS or make a compliant outreach contact. |`);
lines.push(`| D. Not a current fit | ${counts.D || 0} | No record is rejected as a fit; fit remains provisional pending research. |`);
lines.push(`| E. Suppressed / do not contact | ${counts.E || 0} | No suppression evidence was present in the source manifest; authoritative suppression lookup remains required. |`);
lines.push('');
lines.push('The existing dry run recorded 100 prepared messages, 0 send-eligible records, 100 review-only records, and 0 outbound calls. Its deterministic product-fit output is not treated as proof of need or buying intent.');
lines.push('');
lines.push('## 2. First 10 research priorities');
lines.push('');
lines.push('These are **not approved outreach prospects**. They are the first ten records to research because they are the first ten Car Wash records in the manifest and share the strongest currently available provisional product fit. The ranking is based on transparent category fit and stable manifest order, not predicted willingness to buy.');
lines.push('');
lines.push('| Rank | Lead | Business | Category | Phone | Evidence-based reason | Proposed deliverable | Proposal range | Status |');
lines.push('|---:|---:|---|---|---|---|---|---|---|');
shortlist.forEach((lead, i) => {
  const r = rows.find((x) => String(x.id) === String(lead.id));
  lines.push(`| ${i + 1} | ${r.id} | ${esc(r.business)} | ${r.category} | ${r.contact.split(' ')[0]} | Category aligns with provisional website opportunity; phone and Houston location are present; no verified need inferred. | Premium Website Development, subject to discovery and audit | $1,500–$4,000 proposal range | Not eligible; compliance/research review required |`);
});
lines.push('');
lines.push('For proof, the relevant internal example is **Zoey Vincent Personal Brand HQ**, a completed personal-brand website project. It demonstrates delivery capability but does not establish any prospect need, expected outcome, or endorsement.');
lines.push('');
lines.push('## 3. Review-only outreach drafts');
lines.push('');
lines.push('The following drafts are prepared for human review only. They are not queued, approved, or sent. Because SMS eligibility is unresolved, these drafts must not be used to bypass the restriction through another channel. Before any channel is selected, the recipient identity, business relationship, lawful basis, suppression status, and applicable U.S. requirements must be reviewed.');
lines.push('');
shortlist.forEach((lead, i) => {
  const r = rows.find((x) => String(x.id) === String(lead.id));
  lines.push(`### Draft ${i + 1} — ${r.business}`);
  lines.push('');
  lines.push(`- **Recipient:** ${r.business}; phone ${lead.phone}; no named individual identified.`);
  lines.push('- **Channel:** No channel currently eligible. SMS is technically routed to Twilio but blocked by CAP_SMS_SEND_ENABLED=false and missing permission evidence.');
  lines.push('- **Evidence:** Business name, category, Houston location, and phone number from the seeded manifest only.');
  lines.push('- **Draft message:**');
  lines.push('');
  lines.push(`> Hello — I’m reviewing local ${lead.category.toLowerCase()} businesses in Houston for a possible website improvement project. I have not assumed that this is relevant to you. If you are the right person to discuss the business’s website or customer enquiries, would you be open to receiving a short overview? If not, please disregard this message. — Aureum`);
  lines.push('');
  lines.push('- **Approval state:** Do not send. Permission, recipient identity, suppression, and legal review are unresolved.');
});
lines.push('');
lines.push('## 4. Same-day sales path after a lawful positive response');
lines.push('');
lines.push('If a prospect responds through an eligible and approved channel, the operator should first confirm the respondent’s role, actual need, current process, desired outcome, timeline, budget range, decision-makers, procurement requirements, and preferred communication channel. Only after those facts are confirmed should Aureum prepare a tailored scope of work. The indicative website range above is a proposal for discussion, not a quote or promise. An agreement, delivery commitment, invoice, or payment request requires separate commercial approval.');
lines.push('');
lines.push('## 5. Technical and compliance blockers');
lines.push('');
lines.push('| Area | Current finding | Required action |');
lines.push('|---|---|---|');
lines.push('| Contact data | 100 phone numbers; 0 verified emails; no named contacts | Research and verify contact identity and business role. |');
lines.push('| Websites | 100 marked Unverified | Perform a website/domain audit before making a website-specific claim. |');
lines.push('| Permission | No documented lawful basis or channel permission | Record source, evidence, jurisdiction, basis, suppression result, and approval for each recipient. |');
lines.push('| SMS | All 100 blocked; no SMS sent | Keep CAP_SMS_SEND_ENABLED=false until compliance review and explicit approval. |');
lines.push('| Suppression | No source evidence | Query the authoritative suppression list before any proposed contact. |');
lines.push('| Backend | ACM certificate remains Pending validation | Issue certificate, configure ALB HTTPS, deploy API/worker, and connect Vercel. |');
lines.push('| Hunter | Deferred | Do not activate or make paid/API calls; identify only which records need enrichment. |');
lines.push('| n8n | Deferred/optional | Do not make core CAP state or outreach dependent on n8n. |');
lines.push('');
lines.push('## 6. Explicit approvals required');
lines.push('');
lines.push('The operator must approve the research scope and any lawful outreach basis before contacting any record. Separate approval is required for provider credentials or paid enrichment, any SMS activation, any email activation, any proposed commercial pricing, and any agreement or payment request. The current report does not request approval to send.');
lines.push('');
lines.push('## Appendix A — Complete 100-lead readiness register');
lines.push('');
lines.push('| ID | Business | Website / source | Category | Verified contact | Missing / uncertain | Opportunity | Aureum fit | Offer | Channel | Eligibility / evidence | Suppression | Confidence | Readiness | Blocker |');
lines.push('|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
rows.forEach((r) => lines.push(`| ${r.id} | ${esc(r.business)} | ${esc(r.website)}; ${esc(r.source)} | ${esc(r.category)} | ${esc(r.contact)} | ${esc(r.missing)} | ${esc(r.opportunity)} | ${esc(r.fit)} | ${esc(r.offer)} | ${esc(r.channel)} | ${esc(r.eligibility)} | ${esc(r.suppression)} | ${esc(r.confidence)} | ${esc(r.readiness)} | ${esc(r.blocker)} |`));
lines.push('');
lines.push('## References');
lines.push('');
lines.push('[1]: data/leads.json "Seeded 100-lead manifest"');
lines.push('[2]: data/pipeline-dry-run-report.json "CAP V0.1 deterministic no-send dry-run report"');
lines.push('[3]: data/activation-manifest.json "CAP V0.1 activation manifest"');
lines.push('[4]: IMPLEMENTATION_PLAN_V0.1.md "CAP V0.1 implementation plan"');

fs.writeFileSync('CAP_100_LEAD_READINESS_REPORT.md', lines.join('\n') + '\n');
fs.writeFileSync('CAP_100_LEAD_READINESS_SUMMARY.json', JSON.stringify({
  total: rows.length,
  categories: {A: counts.A || 0, B: counts.B || 0, C: counts.C || 0, D: counts.D || 0, E: counts.E || 0},
  unique: dryRun.unique_count,
  duplicates: dryRun.duplicate_count,
  phone_records: leads.filter((l) => l.phone).length,
  verified_emails: dryRun.records.filter((r) => r.email_verified).length,
  send_eligible: dryRun.send_eligible_count,
  outbound_calls: dryRun.outbound_calls,
  shortlist: shortlist.map((l, i) => ({rank: i + 1, id: l.id, business: l.name, category: l.category, phone: l.phone})),
  sending_gates: {CAP_SEND_ENABLED: false, CAP_SMS_SEND_ENABLED: false},
}, null, 2) + '\n');
console.log(JSON.stringify({ok:true, total:rows.length, categories:counts, shortlist:shortlist.map((x) => x.name)}, null, 2));
