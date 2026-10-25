import { createHash } from 'node:crypto';
export const idOk = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(String(id || ''));
// Token proving the background call came from brief-start (derived from the API key; no extra env var).
export const tokenFor = (id) => createHash('sha256').update(id + ':' + (process.env.ANTHROPIC_API_KEY || '')).digest('hex');

export const SEARCH_DOMAINS = [
  // Regulators / official
  'dubailand.gov.ae', 'dxbinteract.com', 'rera.gov.ae', 'dubai.ae', 'u.ae', 'adm.gov.ae', 'rakdlg.gov.ae', 'government.ae', 'icp.gov.ae',
  // Developers
  'emaar.com', 'aldar.com', 'damacproperties.com', 'sobharealty.com', 'nakheel.com', 'meraas.com', 'azizidevelopments.com',
  'binghatti.com', 'danubeproperties.com', 'omniyat.com', 'imkan.ae', 'rakproperties.com', 'marjanisland.com', 'wynnresortsrak.com', 'ellingtongroup.com', 'select-group.ae',
  // News / market data
  'gulfnews.com', 'khaleejtimes.com', 'thenationalnews.com', 'arabianbusiness.com', 'zawya.com', 'gulfbusiness.com', 'propertymonitor.ae',
];

export function briefPrompt(profile, country) {
  const c = (v) => String(v ?? '').slice(0, 200);
  const today = new Date().toISOString().slice(0, 10);
  return `Today is ${today}. Build a UAE property investment brief for this investor using ONLY facts you find with the web search tool.

Investor: Country=${c(country)}, Budget=${c(profile.budget)}, Objective=${c(profile.objective)}, Holding=${c(profile.holding)}, PersonalUse=${c(profile.personalUse)}, Risk=${c(profile.risk)}, Preference=${c(profile.preference)}, GoldenVisa=${c(profile.residency)}, Financing=${c(profile.financing)}.

Research steps (search each; at most 6 searches in total):
1. Current Dubai Land Department / official market statistics and recent transaction price or yield data.
2. Current, real, launched or ready projects from official developer websites (Emaar, Aldar, Sobha, Nakheel, Damac, RAK Properties, etc.) that fit the budget and preference.
3. Recent UAE property news or regulation changes relevant to this investor (Golden Visa rules, fees, off-plan escrow, Ras Al Khaimah developments).

Hard rules:
- NEVER invent projects, prices, yields or dates. Every property in topProperties must be a real project you found in search results, with the exact page you used in sourceUrl.
- If a figure is not published, use null (never guess). Return fewer than 3 properties rather than inventing one.
- evidenceGrade: A = official regulator or developer page, B = reputable news or brokerage, C = estimate. Describe the evidence in evidenceNote (what was verified, what was not).
- Prices must be in AED and inside the investor's budget where the data allows.
- acquisitionCost for the first property: transferFee = 4% DLD fee, agentFee = 2%, legal = 0 unless a source states it, furnishing = 0.
- sources must list every page you relied on (title + url) and nothing else.

Types: pct = integers summing to 100; priceAED and acquisitionCost values = integers in AED or null; grossYield and fiveYrReturn = numbers in percent or null (fiveYrReturn only if a source gives a forecast, otherwise null); lifestyleScore and lifeScores values = integers 0-100 (your judgement, based on location facts); status = ok, warn or req; readiness = integer 0-100; priority = short string.

Reply with ONE JSON object and nothing else (no markdown), keeping every text field under 30 words:
{"asOf":"${today}","emirateAllocation":{"dubai":{"pct":0,"rationale":""},"abuDhabi":{"pct":0,"rationale":""},"rak":{"pct":0,"rationale":""}},"allocationRationale":"","topProperties":[{"name":"","emirate":"","developer":"","priceAED":0,"grossYield":0,"fiveYrReturn":0,"evidenceGrade":"A","evidenceNote":"","sourceUrl":"","ddPoints":["",""],"lifestyleScore":0,"lifeScores":{"school":0,"hospital":0,"airport":0,"beach":0,"marina":0,"commute":0,"privacy":0}}],"acquisitionCost":{"purchasePrice":0,"transferFee":0,"agentFee":0,"legal":0,"furnishing":0,"total":0},"complianceChecklist":[{"label":"","status":"ok","detail":""}],"advisorBrief":{"readiness":0,"priority":"","objections":[""],"nextActions":[""]},"rejectedProperties":[""],"sources":[{"title":"","url":""}]}`;
}
