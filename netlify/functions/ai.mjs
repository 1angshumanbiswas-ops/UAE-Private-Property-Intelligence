// Server-side proxy to the Anthropic API. The key lives only in Netlify env vars.
// The brief is streamed so the connection never sits idle (Netlify drops idle responses at ~30s).
import { json, guard, clip } from './_shared.mjs';

const MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
// The brief is a long JSON document and Netlify cuts functions off at ~26s, so it uses a faster model.
const BRIEF_MODEL = () => process.env.BRIEF_MODEL || 'claude-haiku-5-5';

function anthropicBody({ system, user, max_tokens, stream, model }) {
  return JSON.stringify({ model: model || MODEL(), max_tokens, stream: !!stream, system, messages: [{ role: 'user', content: user }] });
}
const headers = () => ({ 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY || '', 'anthropic-version': '2023-06-01' });

async function callClaude(args) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
  const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: headers(), body: anthropicBody(args) });
  if (!r.ok) throw new Error('Anthropic error ' + r.status);
  return r.json();
}

// Streams only the text deltas back to the browser as plain text.
function streamClaude(args) {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const body = new ReadableStream({
    async start(controller) {
      try {
        if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');
        const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: headers(), body: anthropicBody({ ...args, stream: true }) });
        if (!r.ok || !r.body) throw new Error('Anthropic error ' + r.status);
        const reader = r.body.getReader();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith('data:')) continue;
            try {
              const ev = JSON.parse(line.slice(5));
              if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') controller.enqueue(enc.encode(ev.delta.text));
            } catch { /* ignore keep-alive / partial lines */ }
          }
        }
        controller.close();
      } catch (e) { console.error(e); controller.error(e); }
    },
  });
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
}

export default async (req) => {
  const blocked = guard(req, { limit: Number(process.env.RATE_LIMIT_PER_HOUR || 20) });
  if (blocked) return blocked;

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }

  try {
    if (body.kind === 'brief') {
      const p = body.profile || {};
      const user = 'Investor: Country=' + clip(body.country, 60) + ', Budget=' + clip(p.budget) + ', Objective=' + clip(p.objective) +
        ', Holding=' + clip(p.holding) + ', PersonalUse=' + clip(p.personalUse) + ', Risk=' + clip(p.risk) +
        ', Preference=' + clip(p.preference) + ', GoldenVisa=' + clip(p.residency) + ', Financing=' + clip(p.financing) +
        '. Be very concise: every rationale/detail/note at most 15 words, exactly 2 ddPoints per property, 4 complianceChecklist items, 2 objections, 3 nextActions, 2 rejectedProperties. Return JSON: {emirateAllocation{dubai{pct,rationale},abuDhabi{pct,rationale},rak{pct,rationale}},allocationRationale,topProperties[3]{name,emirate,developer,priceAED,grossYield,fiveYrReturn,evidenceGrade,evidenceNote,ddPoints[],lifestyleScore,lifeScores{school,hospital,airport,beach,marina,commute,privacy}},acquisitionCost{purchasePrice,transferFee,agentFee,legal,furnishing,total},complianceChecklist[]{label,status,detail},advisorBrief{readiness,priority,objections[],nextActions[]},rejectedProperties[]}';
      return streamClaude({
        system: 'You are UAE_RE_AI Orchestrator. Produce a complete UAE property investment brief in JSON only. No markdown, no preamble.',
        user, max_tokens: 2200, model: BRIEF_MODEL(),
      });
    }

    if (body.kind === 'chat') {
      const q = clip(body.q, 500);
      const ctx = clip(body.ctx, 1200);
      if (!q) return json({ error: 'Empty question' }, 400);
      const data = await callClaude({
        system: 'You are the UAE_RE_AI Evidence Agent. Answer from the investor brief only. Max 100 words. No speculation beyond verified data. Context: ' + ctx,
        user: q, max_tokens: 500,
      });
      return json({ text: data.content?.[0]?.text || '' });
    }

    return json({ error: 'Unknown kind' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'Upstream failure' }, 502);
  }
};
