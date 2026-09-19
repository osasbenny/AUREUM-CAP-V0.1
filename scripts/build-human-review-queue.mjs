import fs from 'node:fs';
const leads = JSON.parse(fs.readFileSync('data/leads.json','utf8'));
const selected = leads.filter((l) => l.category === 'Car Wash').slice(0, 10);
const mismatchTerms = {
  Roofing: ['barber','car wash','carwash','lawn','plumbing','tint','detail'],
  'Car Wash': ['barber','roof','lawn','plumbing'],
  'Lawn Care': ['barber','roof','car wash','carwash','plumbing']
};
const queue = selected.map((l, i) => {
  const name = l.name.toLowerCase();
  const possibleMismatch = (mismatchTerms[l.category] || []).filter((term) => name.includes(term));
  return {
    review_rank: i + 1,
    lead_id: l.id,
    business: l.name,
    category: l.category,
    location: l.location,
    phone: l.phone,
    website_status: l.websiteStatus,
    email_status: l.emailStatus,
    proposed_offer: 'Premium Website Development — proposal only; validate need before quoting',
    proposed_channel: 'None currently eligible; phone/SMS requires contact-permission and compliance review',
    evidence_available: ['seeded manifest business name', 'seeded manifest category', 'seeded manifest Houston location', 'seeded manifest phone number'],
    evidence_missing: ['named recipient and role', 'verified website', 'verified email', 'permission/lawful basis', 'suppression result', 'business need', 'timeline', 'budget', 'decision process'],
    data_quality_flag: possibleMismatch.length ? `Name/category mismatch candidate: ${possibleMismatch.join(', ')}` : null,
    approval_state: 'RESEARCH_ONLY_NOT_APPROVED_FOR_CONTACT',
    send_gate: false,
    sms_gate: false
  };
});
fs.writeFileSync('data/first-10-human-review-queue.json', JSON.stringify({
  generated_at: new Date().toISOString(),
  purpose: 'Human review and research preparation only; no outbound activity',
  count: queue.length,
  queue,
  required_approvals: ['contact-permission/lawful-basis review', 'suppression review', 'recipient identity review', 'channel approval', 'message approval']
}, null, 2) + '\n');
console.log(JSON.stringify({ok:true,count:queue.length,flags:queue.filter(x=>x.data_quality_flag).length},null,2));
