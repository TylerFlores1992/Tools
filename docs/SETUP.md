# Setup: Vercel, domain, CI

## Things only the owner can do
1. **Connect the repo to Vercel** (vercel.com → Add New → Project → import
   `TylerFlores1992/Tools`). Framework preset: Next.js. No environment variables are needed.
   After that, every branch push gets a preview URL and merges to `main` deploy production.
2. **Domain: `tylerflores.dev`** (bought at Cloudflare Registrar on 2026-10-02, DNS at Cloudflare).
   In Vercel → Project → Settings → Domains add `tylerflores.dev` (redirect `www` to it), then in
   Cloudflare → `tylerflores.dev` → DNS add the records Vercel shows, **Proxy status: DNS only**:
   `A @ → 76.76.21.21` and `CNAME www → cname.vercel-dns.com` (use Vercel's exact values).
   `.dev` is HTTPS-only (HSTS preloaded); Vercel issues the certificate automatically.
   `src/lib/site.ts` uses `https://tylerflores.dev` as the canonical URL.
3. **`main` exists** (created 2026-10-02 from an empty root). Protect it: require PRs and
   the `verify` check.

## CI
`.github/workflows/ci.yml` runs `npm ci && npm run verify` on every push and pull request.

## After every production deploy
`npm run smoke -- https://tylerflores.dev` — `next build` passing does not prove a page renders.

## Hosting plan
Vercel Hobby ($0). Hobby is for non-commercial use; if a tool ever takes payments or shows
ads, move to Pro. Vercel Web Analytics (cookieless) is the only analytics — no cookie banner.

## Letting Claude do the Vercel and DNS work
- Vercel connector (read deploys and build logs): https://claude.ai/customize/connectors, then a new session.
- `VERCEL_TOKEN` and `CLOUDFLARE_API_TOKEN` (Edit zone DNS, `tylerflores.dev` only) as environment
  variables in the cloud environment settings. Never paste tokens into chat.
