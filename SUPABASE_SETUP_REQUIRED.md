# Supabase Setup Required

## Current blocker

The previously configured Supabase project host `mhzkpmjvxpdegiivvbop.supabase.co` no longer resolves. Both `pnpm run platform:verify` and `pnpm run supabase:verify` fail before reaching the API. The current Vercel production project also has no Supabase URL, publishable key, or service-role variables and is configured to run the demo backend.

As of 2026-08-13, the local Supabase CLI has no authenticated access token, no Supabase access token is present in the process/user/machine environment, and a fresh isolated browser session stops at the Supabase sign-in page. Sign in with the intended new Nbeh account before choosing an organization or creating a project. Do not provision the replacement under BTKK1 or any organization whose ownership is unclear.

Because the master completion gate explicitly requires live Supabase persistence, RLS, merchant authentication, and production-safe backend selection, the project cannot truthfully be marked ready until a new active Supabase project is supplied.

## Required values

Add these to ignored `.env.local` and to Vercel Production:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=
DATABASE_URL=
DIRECT_URL=
DATA_BACKEND=supabase
NEXT_PUBLIC_DEMO_MODE=false
SUPABASE_AGENT_ENABLED=true
AGENT_RATE_LIMIT_SECRET=<at-least-32-random-characters>
```

Never paste secret values into source files, Markdown, chat logs, or public build variables.

On Vercel, Nbeh trusts only Vercel's overwritten `x-forwarded-for` value and stores an HMAC fingerprint rather than the raw address. Self-hosted deployments must leave `TRUST_PROXY_IP_HEADERS=false` unless a trusted reverse proxy strips inbound forwarding headers and writes its own value.

## Activation sequence

First authenticate the intended Nbeh Supabase account and verify the organization name/ownership in the dashboard. Project creation can incur billing and must only happen in that confirmed organization.

```bash
pnpm run supabase:migrate
pnpm run supabase:seed
pnpm run platform:verify
pnpm run supabase:verify
pnpm run db:types
```

Create the merchant owner in Supabase Auth, set `SEED_OWNER_USER_ID` to that Auth UUID, and rerun `pnpm run supabase:seed` to create the owner membership. Configure the same Supabase variables in Vercel, redeploy, verify authenticated dashboard access, send a widget conversation, and confirm the conversation/messages/insights appear under that merchant.

Finally run `pnpm run handoff:check`. Only after it passes may `HANDOFF_REPORT.md` set `READY_FOR_CLIENT_HANDOFF=true`.
