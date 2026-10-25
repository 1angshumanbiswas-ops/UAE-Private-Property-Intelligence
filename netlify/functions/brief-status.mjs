import { getStore } from '@netlify/blobs';
import { json } from './_shared.mjs';
import { idOk } from './_brief.mjs';

export default async (req) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!idOk(id)) return json({ error: 'Bad id' }, 400);
  const rec = await getStore('briefs').get(id, { type: 'json' });
  if (!rec) return json({ status: 'unknown' }, 404);
  return json(rec.status === 'done' ? { status: 'done', result: rec.result, searches: rec.searches } : { status: rec.status, error: rec.error });
};
