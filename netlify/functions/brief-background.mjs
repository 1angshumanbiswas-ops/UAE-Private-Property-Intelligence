// Background function (up to 15 min): runs Claude with web search and stores the result in Netlify Blobs.
import { getStore } from '@netlify/blobs';
import { idOk, tokenFor, briefPrompt, SEARCH_DOMAINS } from './_brief.mjs';

const MODEL = () => process.env.RESEARCH_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

async function call(messages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL(),
      max_tokens: 6000,
      system: 'You are the UAE_RE_AI research analyst. You only state facts that appear in web search results you retrieved. You reply with a single JSON object.',
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6, allowed_domains: SEARCH_DOMAINS }],
      messages,
    }),
  });
  const text = await r.text();
  if (!r.ok) throw new Error('Anthropic ' + r.status + ' ' + text.slice(0, 300));
  return JSON.parse(text);
}

export default async (req) => {
  let body;
  try { body = await req.json(); } catch { return; }
  const { id, profile, country } = body || {};
  if (!idOk(id) || req.headers.get('x-brief-token') !== tokenFor(id)) return;

  const store = getStore('briefs');
  try {
    const messages = [{ role: 'user', content: briefPrompt(profile || {}, country) }];
    let data = await call(messages);
    // Long searches can pause the turn; resume up to a few times.
    for (let i = 0; i < 4 && data.stop_reason === 'pause_turn'; i++) {
      messages.push({ role: 'assistant', content: data.content });
      data = await call(messages);
    }
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').replace(/```json|```/g, '').trim();
    const start = text.indexOf('{'), end = text.lastIndexOf('}');
    if (start < 0 || end < 0) throw new Error('No JSON in model reply');
    const result = JSON.parse(text.slice(start, end + 1));
    const searches = (data.content || []).filter((b) => b.type === 'server_tool_use').length;
    await store.setJSON(id, { status: 'done', result, searches, finished: Date.now() });
  } catch (e) {
    console.error('brief failed', e);
    await store.setJSON(id, { status: 'error', error: String(e.message || e).slice(0, 300) });
  }
};
