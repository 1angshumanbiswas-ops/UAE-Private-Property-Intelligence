# UAE Private Property Intelligence

Single-page investor assessment (Dubai / Abu Dhabi / RAK) with Demo and Live modes.
Live mode runs through Netlify Functions, so API keys and the lead webhook never reach the browser.

## Deploy (Netlify)
1. Import this repo in Netlify (publish dir `.`, no build command).
2. Site configuration -> Environment variables:
   - `ANTHROPIC_API_KEY` (required)
   - `WEBHOOK_URL` - Google Apps Script web app URL for lead capture (required)
   - optional: `ANTHROPIC_MODEL`, `ADVISOR_EMAIL`, `RATE_LIMIT_PER_HOUR`, `ALLOWED_ORIGINS` (see `.env.example`)
3. Set a monthly spend limit on the API key in the Anthropic Console.
