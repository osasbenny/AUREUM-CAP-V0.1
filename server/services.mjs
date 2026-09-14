import dns from 'node:dns/promises';

export const PROVIDERS = {
  AIProvider: { name: 'fallback-template', enabled: false },
  EmailFinderProvider: { name: 'hunter', enabled: false },
  EmailVerificationProvider: { name: 'hunter', enabled: false },
  EmailProvider: { name: 'aws-ses', enabled: false },
  QueueProvider: { name: 'aws-sqs', enabled: false },
  StorageProvider: { name: 'aws-s3', enabled: false },
  WebsiteVerificationProvider: { name: 'cap-http-verifier', enabled: true },
};

export function normalizeKey(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function scoreLead(lead) {
  const text = normalizeKey(`${lead.name} ${lead.category} ${lead.location}`);
  const components = {
    company_fit: lead.category ? 75 : 0,
    buying_signal: /(houston|texas|usa|united states)/i.test(text) ? 80 : 40,
    website_opportunity: lead.website ? 55 : 70,
    decision_maker: 35,
    contact_quality: lead.phone ? 70 : 20,
    location: /(houston|texas)/i.test(text) ? 90 : 45,
    business_size: 50,
  };
  const weights = { company_fit: .25, buying_signal: .20, website_opportunity: .20, decision_maker: .15, contact_quality: .10, location: .05, business_size: .05 };
  const total = Math.round(Object.entries(components).reduce((sum, [key, value]) => sum + value * weights[key], 0) * 100) / 100;
  return { total, components, version: 'deterministic-v0.1', evidence: ['supplied_pdf_metadata', 'phone_presence', 'location_match'], scored_at: new Date().toISOString() };
}

export function matchProducts(lead) {
  const category = normalizeKey(lead.category);
  const fits = [];
  const add = (name, score, evidence) => fits.push({ product: name, score, evidence });
  if (/restaurant|food|bar|cafe/.test(category)) add('AuraPOS', 88, 'Restaurant/food business category');
  if (/church|faith|religious/.test(category)) add('FaithConnect', 88, 'Church/faith organization category');
  if (/freelancer|agency|consult/.test(category)) add('AuraReach', 84, 'Freelancer/agency category');
  if (/startup|software|technology/.test(category)) add('Custom Software', 82, 'Technology/startup category');
  if (/ngo|nonprofit|fundraiser/.test(category)) add('Business Automation', 72, 'Nonprofit/fundraising operations');
  add('Premium Website Development', lead.website ? 64 : 82, lead.website ? 'Website opportunity requires audit' : 'No verified website supplied');
  add('Business Automation', 58, 'General operational improvement hypothesis');
  return fits.sort((a, b) => b.score - a.score);
}

export function fallbackMessage(lead, fit) {
  const business = lead.name || 'your business';
  const product = fit?.product || 'a stronger digital operating system';
  return {
    provider: 'TEMPLATE/FALLBACK',
    version: 'template-v0.1',
    subject: `A practical growth idea for ${business}`,
    body: `Hello,\n\nI’m reaching out because ${business} may be a strong fit for ${product}. We help growing businesses improve their digital customer journey and operational follow-through.\n\nIf this is relevant, would a short conversation next week be useful?\n\nRegards,\nAureum CAP`,
    approval_required: true,
    evidence: ['lead name', 'category', 'deterministic product fit'],
  };
}

export async function verifyWebsite(website) {
  if (!website) return { status: 'UNKNOWN', evidence: ['No website supplied'], checked_at: new Date().toISOString() };
  let url = String(website).trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const started = Date.now();
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(7000) });
    return { status: response.ok ? 'ACTIVE' : 'ERROR', http_status: response.status, final_url: response.url, evidence: [`HTTP ${response.status}`, `redirects resolved`, `latency_ms ${Date.now() - started}`], checked_at: new Date().toISOString() };
  } catch (error) {
    try { await dns.lookup(new URL(url).hostname); return { status: 'BLOCKED', evidence: ['DNS resolves but HTTP check failed', String(error.message).slice(0, 160)], checked_at: new Date().toISOString() }; }
    catch { return { status: 'NOT_FOUND', evidence: ['DNS lookup failed', String(error.message).slice(0, 160)], checked_at: new Date().toISOString() }; }
  }
}

export function isSuppressed(lead, suppressions) {
  const key = normalizeKey(`${lead.name} ${lead.phone}`);
  return suppressions.some((s) => s.key === key || (lead.phone && s.phone === lead.phone));
}

export function audit(events, actor, eventType, entityType, entityId, payload = {}) {
  events.unshift({ id: crypto.randomUUID(), actor, event_type: eventType, entity_type: entityType, entity_id: entityId, payload, occurred_at: new Date().toISOString() });
}

export function uuid() { return crypto.randomUUID(); }
