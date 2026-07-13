import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, ...options.env },
  });

  if (result.error) {
    console.error(result.error.message);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.execPath, [resolve(root, "node_modules", "next", "dist", "bin", "next"), "build"]);

run(process.execPath, [resolve(root, "scripts", "live-agent-qa.mjs"), "--handoff"], {
  env: {
    LIVE_QA_BUILD_STATUS: "PASS",
    LIVE_QA_CONVERSATIONS: process.env.LIVE_QA_CONVERSATIONS || "20",
    LIVE_QA_WIDGET_PRODUCTS: process.env.LIVE_QA_WIDGET_PRODUCTS || "5",
  },
});
