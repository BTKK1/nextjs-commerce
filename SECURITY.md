# Security and Privacy

## Trust boundaries

- Shopper routes receive only a public merchant key, product reference, anonymous visitor reference, and bounded message/page context.
- Shopper chat uses two independent abuse boundaries: visitor-scoped message history and an atomic per-merchant request bucket keyed by a server-derived HMAC fingerprint. On Vercel, only its overwritten `x-forwarded-for` value is trusted; self-hosted deployments must explicitly declare a trusted proxy that strips inbound forwarding headers. Raw IP addresses and forwarding headers are never persisted.
- Dashboard routes require a Founder session or Supabase Auth membership with a merchant role.
- Service-role and provider keys are imported only by server modules and must never use a `NEXT_PUBLIC_` prefix.
- Editable prompts cannot disable catalog grounding, prompt secrecy, payment-data blocking, PII redaction, or unsupported-claim controls.
- Salla/Zid OAuth tokens are not stored raw. The schema exposes only `encrypted_credential_ref` for a future production token vault.
- Dashboard server actions use Next.js same-origin protections, authenticated role checks, merchant-scoped filters, and `SameSite=Lax` session cookies. JSON dashboard mutations require authenticated cookies and do not enable permissive CORS.
- The external loader creates a Nbeh-origin iframe; widget config, chat, and analytics therefore remain same-origin inside that iframe and do not emit permissive CORS headers. The iframe itself is admitted only through the merchant origin allowlist and CSP `frame-ancestors` policy.
- Founder login uses its own atomic 8-attempt/15-minute fingerprint bucket and returns HTTP `429` with `Retry-After`; ordinary merchant emails bypass the Founder endpoint and authenticate directly with Supabase Auth.
- Public and dashboard JSON routes return bounded validation messages and generic service failures; database, provider, and stack details are not returned to browsers.

## Data minimization

The widget does not require a shopper name, phone number, email, or payment details. Visitor references are anonymous. Sensitive text is redacted before persistence where detected. Conversation data is retained only for merchant sales support, quality review, and aggregate insights, and is scoped by `merchant_id`.

## Production requirements

- `DATA_BACKEND=supabase`
- `NEXT_PUBLIC_DEMO_MODE=false`
- Reachable Supabase URL, publishable key, and server-only service key
- RLS migration and `pnpm run supabase:verify` passing
- Unique session, widget-signing, integration-state, and global-config secrets
- HTTPS and merchant-specific widget origin allowlists
- Secret rotation after any suspected disclosure

The application resolves to Supabase in production when no backend is explicitly set; it does not silently activate local JSON. `handoff:check` refuses local/demo mode.

## Reporting

Direct authenticated writes to audit logs, merchant membership, webhook events, and OAuth states are revoked. OAuth, webhook, global governance, prompt governance, and integration-sync evidence is written through server-only service operations or atomic database RPCs. The live RLS verifier proves the full role matrix and cross-merchant isolation once a reachable Supabase project is configured.

Do not include credentials, raw authorization headers, session cookies, shopper PII, system prompts, or stack traces in reports. Security issues should be disclosed privately to the Nbeh platform owner before public discussion.
