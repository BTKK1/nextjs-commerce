# Showcase Build Runbook

This runbook covers the Maison Vert demo milestone for client handoff readiness.

## Readiness Command

Run the complete local gate:

```bash
pnpm run handoff:check
```

This generates Next route types, scans tracked files for secrets, verifies demo assets, seeds local demo data, validates Prisma, runs lint/typecheck/unit/integration/live agent-quality checks, builds, and runs Playwright E2E.

## Preview Server Recovery

Use the shared preview manager before starting a server:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\PC\codex-ops\preview-server-manager.ps1 acquire -ProjectRoot "E:\Saleh`s AI\bagisto-nextjs-commerce" -Command "pnpm exec next dev" -PreferredPort 3000 -Json
```

Use the returned URL. If another project already owns port 3000, the manager may return another registered port such as 3002. If the registry has stale entries, stop only processes whose command line contains this project root, remove only this project root from `C:\Users\PC\.openclaw\preview-servers.json`, and acquire again.

## Auth Boundary

- `NEXTAUTH_SECRET` must be set for customer/account authentication routes.
- The merchant dashboard is public showcase-only in this demo milestone and does not establish a customer session.
- Do not enable demo mode in production merchant environments without replacing the showcase dashboard with real merchant auth.

## Live Agent Failures

- `rate_limited`, `no_credits`, `timeout`, or `provider_error`: inspect `.local/agent-quality-results.json`, `AGENT_QUALITY_REPORT.md`, and server logs from `/api/agent/chat`.
- OpenRouter outage or quota issue: the route falls through the configured OpenRouter fallback model and then the DeepSeek direct route when `DEEPSEEK_API_KEY` is configured.
- All providers fail: the agent returns a `model_error` fallback and logs the provider route, error code, and fallback event.
- Never replace the live route with canned product answers for handoff validation.

## Supabase Persistence

The showcase defaults to local JSON/memory persistence unless `SUPABASE_AGENT_ENABLED=true`.

- Supabase write failures are logged server-side and should not expose service-role credentials.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in local or deployment secrets.
- Use `pnpm run backend:check` before changing schema or persistence behavior.

## Dashboard Triage

Use the merchant dashboard to verify:

- `/dashboard`: KPIs, unknown-answer rate, objections, and recent conversations.
- `/dashboard/conversations`: latest conversations and fallback labels.
- `/dashboard/conversations/[id]`: transcript and product reference.
- `/dashboard/insights`: repeated questions, objections, missing data, and recommended content improvements.
- `/dashboard/settings`: demo mode, model config, tone, guardrails, and retention notes.

The dashboard intentionally does not expose an Integrations page in this showcase build. Demo Catalog, Salla, and Zid provider status remain internal data for future adapters.

## Rollback

- Code rollback: revert the offending commit or restore the last handoff-passing branch state.
- Data rollback: rerun `pnpm run seed:demo` to reset `.local/demo-db.json`.
- Preview rollback: stop this project preview through the registry cleanup procedure, then acquire a fresh preview.
- Agent rollback: restore the previous model env vars, then rerun `pnpm run test:agent:quality` and `pnpm run handoff:check`.
