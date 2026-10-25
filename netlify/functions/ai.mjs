// Server-side proxy to the Anthropic API. The key lives only in Netlify env vars.
import { json, guard, clip } from './_shared.mjs';

const MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

async function callClaude({ system, user, max_tokens }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL(), max_tokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!r.ok) throw new Error('Anthropic error ' + r.status);
  return r.json();
}

export default async (req) => {
  const blocked = guard(req, { limit: Number(process.env.RATE_LIMIT_PER_HOUR || 20) });
  if (blocked) return blocked;

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }

  try {
    if (body.kind === 'brief') {
      const p = body.profile || {};
      const country = clip(body.country, 60);
      const user = 'Investor: Country=' + country + ', Budget=' + clip(p.budget) + ', Objective=' + clip(p.objective) +
        ', Holding=' + clip(p.holding) + ', PersonalUse=' + clip(p.personalUse) + ', Risk=' + clip(p.risk) +
        ', Preference=' + clip(p.preference) + ', GoldenVisa=' + clip(p.residency) + ', Financing=' + clip(p.financing) +
        '. Return JSON: {emirateAllocation{dubai{pct,rationale},abuDhabi{pct,rationale},rak{pct,rationale}},allocationRationale,topProperties[3]{name,emirate,developer,priceAED,grossYield,fiveYrReturn,evidenceGrade,evidenceNote,ddPoints[],lifestyleScore,lifeScores{school,hospital,airport,beach,marina,commute,privacy}},acquisitionCost{purchasePrice,transferFee,agentFee,legal,furnishing,total},complianceChecklist[]{label,status,detail},advisorBrief{readiness,priority,objections[],nextActions[]},rejectedProperties[]}';
      const data = await callClaude({
        system: 'You are UAE_RE_AI Orchestrator. Produce a complete UAE property investment brief in JSON only. No markdown, no preamble.',
        user, max_tokens: 4000,
      });
      return json({ text: data.content?.[0]?.text || '' });
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
