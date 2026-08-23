import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

const host = process.env.HOST || process.env.HOSTNAME || "127.0.0.1";
const port = process.env.PORT || "3100";
const production = process.argv.includes("--production");
const environment = {
  ...process.env,
  AGENT_MODE: process.env.AGENT_MODE || "live",
  NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE || "true",
  DATA_BACKEND: process.env.DATA_BACKEND || "local",
  SUPABASE_AGENT_ENABLED: process.env.SUPABASE_AGENT_ENABLED || "false",
  DEMO_DATA_FILE: process.env.DEMO_DATA_FILE || join(tmpdir(), `nbeh-playwright-${process.pid}.json`),
  SALES_AGENT_MODEL: process.env.CONTINUOUS_TEST_MODEL || "stealth/ox-alpha",
  SALES_AGENT_DISABLE_FALLBACKS: "true",
  PRODUCT_AGENT_DISABLE_FALLBACKS: "true",
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || `http://${host}:${port}`,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "playwright-local-secret",
};

const child = spawn(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "next", production ? "start" : "dev", ...(production ? [] : ["--webpack"]), "-H", host, "-p", port],
  { env: environment, stdio: "inherit", shell: process.platform === "win32" },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
