export function normalizeE164(phone) {
  const value = String(phone || '').replace(/[^+\d]/g, '');
  if (/^\+\d{10,15}$/.test(value)) return value;
  if (/^\d{10}$/.test(value)) return `+1${value}`;
  return null;
}

export function routeSms(phone) {
  const normalized = normalizeE164(phone);
  if (!normalized) return { provider: null, phone: null, status: 'INVALID_PHONE' };
  return { provider: normalized.startsWith('+1') ? 'twilio' : 'termii', phone: normalized, status: 'ROUTED' };
}

export function smsOpener(lead, product = 'a stronger digital presence') {
  const business = lead.name || 'your business';
  return `Hi, I came across ${business} in Houston and noticed an opportunity to improve your online visibility. We help local businesses get more leads with modern websites and booking systems. Would you be open to a quick conversation? — Osagie, Aureum Technologies`;
}

export function smsEligibility(lead) {
  const route = routeSms(lead.phone);
  if (!route.phone) return { eligible: false, reason: 'invalid_phone', route };
  if (lead.suppressed || lead.sms_suppressed) return { eligible: false, reason: 'suppressed', route };
  if (lead.sms_approval_state !== 'APPROVED') return { eligible: false, reason: 'human_approval_required', route };
  if (lead.consent_status !== 'ESTABLISHED') return { eligible: false, reason: 'permission_basis_required', route };
  if (lead.sms_sent_at || lead.sms_provider_id) return { eligible: false, reason: 'duplicate_send_prevention', route };
  return { eligible: true, reason: null, route };
}

export async function sendTwilioSms({ to, body, statusCallback }) {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM_NUMBER: from, TWILIO_MESSAGING_SERVICE_SID: serviceSid } = process.env;
  if (!sid || !token || (!from && !serviceSid)) throw new Error('Twilio server configuration is incomplete');
  const params = new URLSearchParams({ To: to, Body: body });
  if (serviceSid) params.set('MessagingServiceSid', serviceSid); else params.set('From', from);
  if (statusCallback) params.set('StatusCallback', statusCallback);
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: params });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || `Twilio request failed: ${response.status}`);
  return { provider: 'twilio', provider_id: result.sid, status: result.status, to: result.to, raw_status: result };
}

export async function sendTermiiSms({ to, body, statusCallback }) {
  const { TERMII_API_KEY: api_key, TERMII_SENDER_ID: from, TERMII_BASE_URL = 'https://api.ng.termii.com' } = process.env;
  if (!api_key || !from) throw new Error('Termii server configuration is incomplete');
  const response = await fetch(`${TERMII_BASE_URL}/api/sms/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key, to: to.replace(/^\+/, ''), from, sms: body, type: 'plain', channel: 'generic', status_callback_url: statusCallback }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || `Termii request failed: ${response.status}`);
  return { provider: 'termii', provider_id: result.message_id_str || result.message_id, status: result.code === 'ok' ? 'queued' : 'failed', to, raw_status: result };
}
