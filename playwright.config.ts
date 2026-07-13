import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function loadLocalEnv() {
  const output: Record<string, string> = {};
  for (const filename of [".env.local", ".env"]) {
    const path = join(process.cwd(), filename);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      if (process.env[key]) continue;
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      output[key] = value;
      process.env[key] = value;
    }
  }
  return output;
}

const localEnv = loadLocalEnv();
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const shouldStartServer = !process.env.PLAYWRIGHT_BASE_URL && !process.env.CI_PREVIEW_SERVER;
const useBuildServer = process.env.PLAYWRIGHT_USE_BUILD_SERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: 2,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: shouldStartServer
    ? {
        command: useBuildServer ? "pnpm exec next start -H 127.0.0.1 -p 3100" : "pnpm exec next dev --webpack -H 127.0.0.1 -p 3100",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...localEnv,
          ...process.env,
          AGENT_MODE: "live",
          NEXT_PUBLIC_DEMO_MODE: "true",
          SUPABASE_AGENT_ENABLED: "false",
          SALES_AGENT_MODEL: "google/gemini-2.5-flash-lite",
          SALES_AGENT_FALLBACK_MODEL: "qwen/qwen3-235b-a22b-2507",
          SALES_AGENT_FALLBACK2_MODEL: "deepseek-chat",
          NEXTAUTH_URL: baseURL,
          NEXTAUTH_SECRET: "playwright-local-secret"
        }
      }
    : undefined,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] }
    }
  ]
});
