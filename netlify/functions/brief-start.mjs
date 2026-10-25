// Starts a research job: validates the caller, then hands off to the background function.
import { getStore } from '@netlify/blobs';
import { json, guard, clip } from './_shared.mjs';
import { tokenFor } from './_brief.mjs';
import { randomUUID } from 'node:crypto';

export default async (req) => {
  const blocked = guard(req, { limit: Number(process.env.BRIEF_RATE_LIMIT_PER_HOUR || 6), key: 'brief' });
  if (blocked) return blocked;
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Service not configured' }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  const p = body.profile || {};
  const profile = {};
  for (const k of ['budget', 'objective', 'holding', 'personalUse', 'risk', 'preference', 'residency', 'financing', 'timing']) profile[k] = clip(p[k], 120);

  const id = randomUUID();
  const store = getStore('briefs');
  await store.setJSON(id, { status: 'pending', created: Date.now() });

  const origin = new URL(req.url).origin;
  const r = await fetch(origin + '/.netlify/functions/brief-background', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-brief-token': tokenFor(id) },
    body: JSON.stringify({ id, profile, country: clip(body.country, 60) }),
  });
  if (r.status >= 400) {
    await store.setJSON(id, { status: 'error', error: 'Could not start research job (' + r.status + ')' });
    return json({ error: 'Could not start' }, 502);
  }
  return json({ id });
};
