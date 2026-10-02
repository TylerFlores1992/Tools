# Setup: Vercel, domain, CI

## Current state (2026-10-02)
- **Vercel project:** `tylerflores-dev` (Hobby, scope `tyler-flores1992`), linked to
  `TylerFlores1992/Tools`, framework Next.js, no environment variables.
- **Domains on the project:** `tylerflores.dev` (primary) and `www.tylerflores.dev` (308 → apex).
- **DNS** is at Cloudflare (registrar + nameservers `aldo`/`aleena.ns.cloudflare.com`).
  Records, **Proxy status: DNS only** (grey cloud), using the exact values Vercel's
  Domains page shows; the long-standing defaults are `A @ → 76.76.21.21` and
  `CNAME www → cname.vercel-dns.com`. `.dev` is HTTPS-only (HSTS preloaded); Vercel
  issues the certificate once DNS resolves.
- `src/lib/site.ts` uses `https://tylerflores.dev` as the canonical URL.

## Owner-only settings (the connector can't change these)
1. **Production branch → `main`.** The repo's GitHub default branch is still the old
   session branch, and Vercel took its production branch from it. Fix both:
   GitHub → Settings → General → Default branch → `main`; Vercel → project → Settings →
   Environments → Production → Branch Tracking → `main` (older dashboards: Settings → Git →
   Production Branch). Until then, deploy production by
   hand from `main` (the connector's `create_deployment` with `target: production`).
2. **Protect `main`:** require PRs and the `verify` check.

## CI
`.github/workflows/ci.yml` runs `npm ci && npm run verify` on every push and pull request.

## After every production deploy
`npm run smoke -- https://tylerflores.dev` — `next build` passing does not prove a page renders.

## Hosting plan
Vercel Hobby ($0). Hobby is for non-commercial use; if a tool ever takes payments or shows
ads, move to Pro. Vercel Web Analytics (cookieless) is the only analytics — no cookie banner.

## Letting Claude do the Vercel and DNS work
- **Vercel:** the claude.ai Vercel connector is connected and can create projects, add domains
  and deploy. It is scoped to the personal account: pass **no `teamId`** (passing
  `team_OejYsMJrOdtB1HaNnnDU5KLj` or the slug returns 403 "re-authenticate to this scope"),
  so use `create_project`, not `create_git_project` (which requires a teamId). No
  `VERCEL_TOKEN` needed.
- **Cloudflare DNS:** `CLOUDFLARE_API_TOKEN` (Edit zone DNS, `tylerflores.dev` only) as an
  environment variable in the cloud environment settings. Never paste tokens into chat.
