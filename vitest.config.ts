import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globals: false,
    pool: "forks",
    testTimeout: 60_000,
    env: {
      AGENT_MODE: "live",
      NEXT_PUBLIC_DEMO_MODE: "true",
      DATA_BACKEND: "local",
      SUPABASE_AGENT_ENABLED: "false"
    }
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url))
    }
  }
});
