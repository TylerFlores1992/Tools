# Setup: Vercel, domain, CI

## Current state (2026-10-02)
- **Vercel project:** `tylerflores-dev` (Hobby, scope `tyler-flores1992`), linked to
  `TylerFlores1992/Tools`, framework Next.js, no environment variables.
- **Domains on the project:** `tylerflores.dev` (primary) and `www.tylerflores.dev` (308 → apex).
- **DNS** is at Cloudflare (registrar + nameservers `aldo`/`aleena.ns.cloudflare.com`), added
  2026-10-02, **Proxy status: DNS only** (grey cloud): `A @ → 76.76.21.21`,
  `CNAME www → cname.vercel-dns.com`. Vercel issued Let's Encrypt certs for both and renews
  them. Vercel's Domains page shows "DNS Change Recommended" (a project-specific
  `….vercel-dns-0NN.com` CNAME for `@` and `www`); its own note says the legacy records keep
  working, so switching is optional. `.dev` is HTTPS-only (HSTS preloaded).
- `src/lib/site.ts` uses `https://tylerflores.dev` as the canonical URL.

## Owner-only settings (the connector can't change these)
1. **GitHub default branch → `main`** (GitHub → Settings → General → Default branch). It is
   still the old session branch, so new PRs default to the wrong base. Vercel is not affected:
   a push to the session branch built as a preview, not production (checked 2026-10-02).
2. **Protect `main`:** require PRs and the `verify` check.

## CampHawk lab password
`/lab/camphawk` (CampHawk design sandbox) is locked by `src/proxy.ts` with HTTP Basic auth
against **`LAB_PASSWORD`**. With it unset the lab is locked for everyone. The owner sets it,
never in code or chat: Vercel → `tylerflores-dev` → Settings → Environment Variables → add
`LAB_PASSWORD` (Production, and Preview if wanted), Sensitive → Save, then redeploy (Deployments
→ latest → ⋯ → Redeploy). Sign in with any username plus that password. Vercel's own Password
Protection is a paid Pro add-on, hence this.

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
