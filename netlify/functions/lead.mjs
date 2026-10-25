// Forwards leads to the Google Apps Script webhook (URL kept in env, never sent to browser).
import { json, guard, clip } from './_shared.mjs';

const FIELDS = ['timestamp','source','advisor_email','investor_name','country','budget','objective','holding_period',
  'personal_use','risk_profile','preference','golden_visa','financing','consultation_timing','allocation_dubai',
  'allocation_abudhabi','allocation_rak','property_1','property_2','property_3','readiness_score','priority','compliance_flags','email','mobile','consent'];

// Neutralise spreadsheet formula injection.
const safe = (v) => { const s = clip(v, 500); return /^[=+\-@]/.test(s) ? "'" + s : s; };

export default async (req) => {
  const blocked = guard(req, { limit: Number(process.env.RATE_LIMIT_PER_HOUR || 20) });
  if (blocked) return blocked;
  const url = process.env.WEBHOOK_URL;
  if (!url) return json({ error: 'WEBHOOK_URL not configured' }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }

  const email = clip(body.email, 120).trim();
  const mobile = clip(body.mobile, 30).trim();
  const digits = mobile.replace(/\D/g, '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !/^\+?[0-9 ()\-]+$/.test(mobile) || digits.length < 8 || digits.length > 15) {
    return json({ error: 'Valid email and mobile number are required' }, 400);
  }

  const out = {};
  for (const f of FIELDS) out[f] = Array.isArray(body[f]) ? body[f].map(safe).join('; ') : safe(body[f]);
  out.timestamp = new Date().toISOString();
  out.source = 'UAE_RE_AI';
  out.advisor_email = process.env.ADVISOR_EMAIL || out.advisor_email;

  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(out), redirect: 'follow' });
    if (!r.ok) throw new Error('webhook ' + r.status);
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: 'Lead capture failed' }, 502);
  }
};
