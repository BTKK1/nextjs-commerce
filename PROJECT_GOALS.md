# Project Goals

## Master Goal

Make the Bagisto-based demo store and product-page AI sales agent ready for client handoff.

## Current Phase

Client handoff readiness and deployment stabilization:

- Authoritative app root: `E:\Saleh`s AI\bagisto-nextjs-commerce`.
- Package manager: `pnpm` via `pnpm-lock.yaml` and `packageManager: pnpm@11.7.0`.
- Framework: Next.js app router with Bagisto-style public routes and a Maison Vert showcase layer.
- Keep the agent live-LLM only, with no scripted shopper-answer mode.
- Keep the OpenRouter/DeepSeek handoff suite passing when a provider key is configured.
- Maintain the Ting-style product-agent route order: OpenRouter Gemini Flash Lite, OpenRouter Qwen fallback, DeepSeek direct fallback.
- Keep dashboard/provider integrations as demo milestone stubs: Demo Catalog connected, Salla and Zid not connected.
- Prevent drift between implementation, tests, and handoff docs before client walkthroughs.

## Current State Snapshot - 2026-07-08

- Repo inspected: `bagisto-nextjs-commerce` is the only git repository under the workspace.
- Duplicate/non-authoritative scaffold noted: the parent `E:\Saleh`s AI` directory has its own `package.json`, `src`, `tests`, and dashboard/product routes. It is not the git root and is not the current handoff target.
- Graphify exists only in `bagisto-nextjs-commerce/graphify-out`; latest graph update rebuilt 1046 nodes and 1026 edges.
- Current final gate evidence is in `HANDOFF_REPORT.md`, `.codex-loop/state.json`, `AGENT_QUALITY_REPORT.md`, `AGENT_QUALITY_REPORT_LIVE.md`, `SCREENSHOT_AUDIT.md`, `PRODUCT_PAGE_AUDIT.md`, and `DASHBOARD_AUDIT.md`.
- Latest readiness state: `READY_FOR_CLIENT_HANDOFF=true`, `consecutiveZeroFindingLoops=3`, `P0_OPEN=0`, `P1_OPEN=0`, `P2_OPEN=0`.
- Latest deterministic agent score: 9.81/10 across 102 cases, 0 hard failures.
- Latest live OpenRouter score: 9.37/10 across 102 cases, 0 hard failures.

## Store Direction

The current user direction is to use `bagisto/nextjs-commerce` as the store base. This repo now uses the Maison Vert Bagisto-style demo storefront and product catalog as the client-facing store demo.

## Acceptance Checklist

- [x] Storefront route exists.
- [x] Product detail routes exist for the current demo catalog.
- [x] Product images are present and verified by screenshots.
- [x] Add-to-bag, size, color, size guide, cart, and checkout demo flows work in E2E.
- [x] Floating product chat widget is responsive and Ting-styled.
- [x] Dashboard routes exist for overview, conversations, conversation detail, insights, products, integrations, and settings.
- [x] Merchant dashboard Integrations route shows provider status for the showcase build.
- [x] Demo Catalog is connected, while Salla and Zid are visible as not connected demo stubs.
- [x] Every valid shopper question uses the live provider route; deterministic tests mock only the provider boundary.
- [x] Server-side conversation history is included for contextual follow-up answers.
- [x] Supabase env, helpers, Prisma config, and schema workflow are wired.
- [x] Agent persistence can use Supabase when configured and local JSON/memory otherwise.
- [x] Product agent uses Ting-style model orchestration and telemetry.
- [x] Agent widget is branded for Maison Vert, not the old Tingy placeholder.
- [x] Agent requests include current product page URL, path, title, and product name context.
- [x] Product-page widget appears and responds on desktop and mobile product pages.
- [x] English and Arabic agent response evaluations pass.
- [x] Arabic deterministic responses, guardrails, insights, and eval fixtures use valid UTF-8 Arabic.
- [x] Product knowledge and unsupported-claim evaluations pass.
- [x] CI workflow includes backend/eval checks and the full handoff readiness command.
- [x] Full local CI-style verification passes after the backend/agent changes.
- [x] Runbook exists for preview recovery, live-agent failures, Supabase persistence, dashboard triage, and rollback.
- [x] CI/CD workflow runs the deterministic handoff readiness command and has a manual live smoke job.

## Out Of Scope For This Phase

- Real Salla or Zid OAuth.
- Real marketplace webhooks.
- Real payments or production checkout.
- Direct production data deletion.
- Client-side exposure of service-role credentials.

## Remaining Delta

- Future Salla/Zid real adapters after the demo is approved.
- Keep the parent workspace scaffold out of client/deployment flows unless it is intentionally migrated or removed in a separate cleanup goal.
