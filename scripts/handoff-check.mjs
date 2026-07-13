import { acquirePreviewServer, baseHandoffEnv, runPnpm, stopLocalPreviewServer } from "./lib/handoff-utils.mjs";

const env = baseHandoffEnv({
  AGENT_MODE: "live",
  AGENT_QUALITY_MODE: "live",
});

async function main() {
  if (!env.OPENROUTER_API_KEY && !env.DEEPSEEK_API_KEY) {
    throw new Error("Client handoff requires OPENROUTER_API_KEY or DEEPSEEK_API_KEY because scripted agent answers are disabled.");
  }
  const providedPreviewUrl = process.env.PLAYWRIGHT_BASE_URL;
  const browserBaseEnv = {
    ...env,
    PLAYWRIGHT_USE_BUILD_SERVER: "1",
  };

  runPnpm("tracked secret scan", ["run", "secrets:check"], env);
  runPnpm("generate demo assets", ["run", "generate:demo-assets"], env);
  runPnpm("seed demo data", ["run", "seed:demo"], env);
  runPnpm("backend schema check", ["run", "backend:check"], env);
  runPnpm("lint", ["run", "lint"], env);
  runPnpm("typecheck", ["run", "typecheck"], env);
  runPnpm("unit tests", ["run", "test:unit"], env);
  runPnpm("integration tests", ["run", "test:integration"], env);
  if (!providedPreviewUrl) {
    stopLocalPreviewServer();
    runPnpm("production build for browser audits", ["run", "build"], browserBaseEnv);
  }

  const preview = await acquirePreviewServer(browserBaseEnv);
  const browserEnv = {
    ...browserBaseEnv,
    PLAYWRIGHT_BASE_URL: preview.url,
    CI_PREVIEW_SERVER: "1",
    NEXTAUTH_URL: preview.url,
  };

  try {
    runPnpm("product page E2E", ["run", "test:e2e:product-pages"], browserEnv);
    runPnpm("agent E2E", ["run", "test:e2e:agent"], browserEnv);
    runPnpm("dashboard E2E", ["run", "test:e2e:dashboard"], browserEnv);
    runPnpm("agent quality matrix", ["run", "test:agent:quality"], env);
    runPnpm("screenshot audit", ["run", "audit:screenshots"], browserEnv);
    runPnpm("product page audit", ["run", "audit:product-pages"], browserEnv);
    runPnpm("dashboard audit", ["run", "audit:dashboard"], browserEnv);
  } finally {
    await preview.cleanup();
    if (!providedPreviewUrl) stopLocalPreviewServer();
  }

  runPnpm("production build", ["run", "build"], env);
  console.log("\nClient handoff acceptance checkpoint passed locally.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
