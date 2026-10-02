# Setup: Vercel, domain, CI

## Current state (2026-10-02)
- **Vercel project:** `tylerflores-dev` (Hobby, scope `tyler-flores1992`), linked to
  `TylerFlores1992/Tools`, framework Next.js. Production deploys from `main` automatically;
  other branches get preview URLs.
- **Environment variables:** one, `LAB_PASSWORD` (Production, Sensitive), set by the owner on
  2026-10-02. It is the Private tab's password; see "Private area password" below.
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

## Private area password
The **Private** tab (`/private`: the CampHawk lab and future projects) is signed-in only.
`src/proxy.ts` sends anyone without a valid session to `/private/sign-in`, the site's own
password page: one field, no username. The password is the `LAB_PASSWORD` environment
variable. If it's missing, nobody can sign in.

- **Status:** set by the owner on 2026-10-02, Production only, marked Sensitive.
- **To sign in:** open https://tylerflores.dev/private (or tap Private), enter the password.
  You stay signed in on that device for 30 days (a signed, HttpOnly cookie scoped to
  `/private`). **Sign out** is on the Private page.
- **To change the password:** Vercel → `tylerflores-dev` → Settings → Environment Variables →
  `LAB_PASSWORD` → Edit → Save, then Deployments → latest → ⋯ → Redeploy. A change only takes
  effect after a redeploy, and it signs out every device.
- **Never** put the password in code, docs or chat. Claude can't read it (Sensitive values are
  write-only) and doesn't need to.
- **Preview deployments** don't have the variable, so nobody can sign in there. Add Preview to
  the variable's environments if that's ever wanted.
- **Why not Vercel's own password protection:** it's a paid Pro add-on.
- **Checks:** `npm run smoke` asserts production keeps `/private` behind the sign-in page and
  refuses its files; `npm run e2e` covers the whole flow in Chrome (wrong/empty password, deep
  links, `?next` that can't leave the area, cookie flags, sign-out, no JavaScript).

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
