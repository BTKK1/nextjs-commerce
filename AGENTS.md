# Nbeh credential and model policy

- Only the Saleh-owned OpenRouter credential is authorized for this repository, local development, Vercel, and GitHub Actions.
- Never replace `OPENROUTER_API_KEY` with a personal or unrelated OpenRouter key.
- Keep `OPENROUTER_ENFORCE_KEY_SHA256=true` and keep `OPENROUTER_KEY_SHA256` aligned with the Saleh-owned key. The runtime must fail closed when the fingerprint does not match.
- The authorized Nbeh model is `z-ai/glm-5.3-flash` through OpenRouter. It is the official underlying model that replaced the retired `stealth/ox-alpha` test alias. Never restore the retired alias.
- Keep model fallbacks disabled while the GLM-5.3-Flash-only policy is active. Do not route to another OpenRouter model or a direct provider.
- Never print, commit, log, or include API key values in reports, diffs, or chat responses.
