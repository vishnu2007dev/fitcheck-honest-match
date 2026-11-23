# FitCheck: Honest Match

Paste a job posting and a resume. Get a fit score where every match and gap shows its receipt.

## How it is built

- `public/SKILL.md` is the Honest Match Protocol: the reusable instruction set any AI agent can follow. It is served at `/SKILL.md` and is also the system prompt the backend sends.
- `api/match.js` is a Vercel serverless function. It sends SKILL.md plus the posting, resume and profile to an OpenRouter model (default `openrouter/free`).
- `lib/engine.js` is the scoring engine. It checks every quote against the real text (fake receipts score 0), then applies fixed weights. The browser runs the same check again.
- `src/` is the React site (Vite + framer-motion).

## Deploy (about 5 minutes)

You need Node.js 18 or newer.

```bash
cd fitcheck
npm install
npx vercel login          # opens your browser, sign in with the account that hosts your portfolio
npx vercel --prod         # accept the defaults; it detects Vite
```

## Where the API key goes

The key goes in Vercel, never in the code:

1. Vercel dashboard, open the `fitcheck` project, then Settings, then Environment Variables.
2. Add key `OPENROUTER_API_KEY`, value = your OpenRouter key (starts with `sk-or-v1-`), environments Production and Preview.
3. Redeploy: `npx vercel --prod` (or Deployments, then the three dots, then Redeploy).

Or from the terminal: `npx vercel env add OPENROUTER_API_KEY production`, paste the key, then `npx vercel --prod`.

Check it worked: open `https://YOUR-URL/api/match` in a browser. It should say `"key_configured": true`.

## Optional

- `OPENROUTER_MODEL`: comma-separated model ids to try in order, for example `openrouter/free,meta-llama/llama-3.3-70b-instruct:free`.
- Make sure the production link is public: Settings, then Deployment Protection, then Vercel Authentication should not cover production.
