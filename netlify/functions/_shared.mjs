// Shared helpers: CORS/origin guard, best-effort rate limit, JSON responses.
const hits = new Map(); // per warm-instance, best effort only

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export function guard(req, { limit = 20, windowMs = 3600_000 } = {}) {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  // Only accept calls coming from this site (or ALLOWED_ORIGINS, comma-separated).
  const origin = req.headers.get('origin') || '';
  const allowed = (process.env.ALLOWED_ORIGINS || process.env.URL || '')
    .split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (allowed.length && !isLocal && !allowed.includes(origin.replace(/\/$/, ''))) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  // Simple per-IP rate limit.
  const ip = (req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < windowMs);
  if (arr.length >= limit) return json({ error: 'Rate limit reached. Please try again later.' }, 429);
  arr.push(now); hits.set(ip, arr);
  return null;
}

export const clip = (v, n = 200) => String(v ?? '').slice(0, n);
