# Setup: Vercel, domain, CI

## Current state (2026-10-02)
- **Vercel project:** `tylerflores-dev` (Hobby, scope `tyler-flores1992`), linked to
  `TylerFlores1992/Tools`, framework Next.js. Production deploys from `main` automatically;
  other branches get preview URLs.
- **Environment variables:** one, `LAB_PASSWORD` (Production, Sensitive), set by the owner on
  2026-10-02. See "CampHawk lab password" below.
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
`/lab/camphawk` is private. `src/proxy.ts` asks for a password (HTTP Basic auth) and compares
it with the `LAB_PASSWORD` environment variable. If the variable is missing, the lab is locked
for everyone.

- **Status:** set by the owner on 2026-10-02, Production only, marked Sensitive.
- **To open the lab:** go to https://tylerflores.dev/lab/camphawk and sign in with any
  username plus the password.
- **To change the password:** Vercel → `tylerflores-dev` → Settings → Environment Variables →
  `LAB_PASSWORD` → Edit → Save, then Deployments → latest → ⋯ → Redeploy. A change only takes
  effect after a redeploy.
- **Never** put the password in code, docs or chat. Claude can't read it (Sensitive values are
  write-only) and doesn't need to.
- **Preview deployments** don't have the variable, so the lab is locked there too. Add
  Preview to the variable's environments if that's ever wanted.
- **Why not Vercel's own password protection:** it's a paid Pro add-on.
- **Checks:** `npm run smoke` asserts production answers 401 without the password;
  `npm run e2e` checks no password, a wrong password and the right one locally.

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
