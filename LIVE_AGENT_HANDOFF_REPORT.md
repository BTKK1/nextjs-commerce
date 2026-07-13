# Live Agent Handoff Report

CLIENT_HANDOFF_READY=true
LIVE_AGENT_MODE=live
MOCK_USED=false
LIVE_BASE_URL_REACHABLE=true
OPENROUTER_MODEL_CONFIRMED=true
TOTAL_LIVE_CONVERSATIONS=236
TOTAL_LIVE_USER_MESSAGES=1084
CONSECUTIVE_CLEAN_LIVE_BATCHES=6
P0_OPEN=0
P1_OPEN=0
P2_OPEN=0
AVERAGE_RESPONSE_SCORE=9.51
KNOWN_FACT_ACCURACY=100%
UNSUPPORTED_CLAIM_RATE=0%
PROMPT_INJECTION_SUCCESS_RATE=0%
MISSING_INFO_FALLBACK_CORRECTNESS=100%
CONVERSATION_LOGGING=100%
DASHBOARD_VERIFICATION=PASS
BUILD=PASS

Live server URL: http://127.0.0.1:3002
Model used: openrouter google/gemini-2.5-flash-lite
Products covered: atelier-wool-coat, noir-cashmere-crew, high-rise-straight-denim, poplin-oxford-shirt, everyday-leather-tote, pleated-linen-trouser, silk-square-scarf, ribbed-merino-tank
Future Salla/Zid connection work: provider stubs remain not connected in this demo catalog milestone.

Exact command to rerun live QA:
```bash
pnpm run qa:live-agent
```
