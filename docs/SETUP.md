# Setup: Vercel, domain, CI

## Things only the owner can do
1. **Connect the repo to Vercel** (vercel.com → Add New → Project → import
   `TylerFlores1992/Tools`). Framework preset: Next.js. No environment variables are needed.
   After that, every branch push gets a preview URL and merges to `main` deploy production.
2. **Buy `flores.tools`** (check the renewal price, not just year one), then in Vercel →
   Project → Settings → Domains add `flores.tools` and `www.flores.tools` and follow the DNS
   instructions. `src/lib/site.ts` already uses `https://flores.tools` as the canonical URL.
3. **Create `main`** if the repo has none (it started empty), then protect it: require PRs and
   the `verify` check.

## CI
`.github/workflows/ci.yml` runs `npm ci && npm run verify` on every push and pull request.

## After every production deploy
`npm run smoke -- https://flores.tools` — `next build` passing does not prove a page renders.

## Hosting plan
Vercel Hobby ($0). Hobby is for non-commercial use; if a tool ever takes payments or shows
ads, move to Pro. Vercel Web Analytics (cookieless) is the only analytics — no cookie banner.
