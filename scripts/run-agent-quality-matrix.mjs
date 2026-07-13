import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const resultPath = join(root, ".local", "agent-quality-results.json");
const reportPath = join(root, "AGENT_QUALITY_REPORT.md");
const jsonReportPath = join(root, "AGENT_QUALITY_REPORT.json");
const mode = "live";

loadLocalEnv();

if (!process.env.OPENROUTER_API_KEY && !process.env.DEEPSEEK_API_KEY) {
  console.error("Agent quality requires OPENROUTER_API_KEY or DEEPSEEK_API_KEY because scripted answers are disabled.");
  process.exit(1);
}

function loadLocalEnv() {
  for (const filename of [".env.local", ".env"]) {
    const path = join(root, filename);
    if (!existsSync(path)) continue;
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      if (process.env[key]) continue;
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

mkdirSync(dirname(resultPath), { recursive: true });

const env = {
  ...process.env,
  AGENT_QUALITY_MODE: mode,
  AGENT_MODE: mode,
  DEMO_PERSISTENCE: "memory",
  SUPABASE_AGENT_ENABLED: "false",
  SALES_AGENT_MODEL: process.env.SALES_AGENT_MODEL || "google/gemini-2.5-flash-lite",
  SALES_AGENT_FALLBACK_MODEL: process.env.SALES_AGENT_FALLBACK_MODEL || "qwen/qwen3-235b-a22b-2507",
  SALES_AGENT_FALLBACK2_MODEL: process.env.SALES_AGENT_FALLBACK2_MODEL || "deepseek-chat",
  PRODUCT_AGENT_MODEL: process.env.PRODUCT_AGENT_MODEL || "google/gemini-2.5-flash-lite",
  PRODUCT_AGENT_FALLBACK_MODEL: process.env.PRODUCT_AGENT_FALLBACK_MODEL || "qwen/qwen3-235b-a22b-2507",
  PRODUCT_AGENT_FALLBACK2_MODEL: process.env.PRODUCT_AGENT_FALLBACK2_MODEL || "deepseek-chat",
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite",
};

const command = process.platform === "win32" ? "cmd.exe" : "pnpm";
const args =
  process.platform === "win32"
    ? ["/d", "/s", "/c", "pnpm exec vitest run tests/integration/agent-quality-matrix.test.ts"]
    : ["exec", "vitest", "run", "tests/integration/agent-quality-matrix.test.ts"];
const run = spawnSync(command, args, {
  cwd: root,
  env,
  stdio: "inherit",
});

if (run.error) {
  console.error(run.error.message);
  process.exit(1);
}

if (run.status !== 0) {
  process.exit(run.status ?? 1);
}

if (!existsSync(resultPath)) {
  console.error(`Missing matrix output: ${resultPath}`);
  process.exit(1);
}

const summary = JSON.parse(readFileSync(resultPath, "utf8"));
const failed = summary.results.filter((item) => !item.evaluation.passed || item.evaluation.hardFailures.length > 0);

const lines = [
  "# Agent Quality Report",
  "",
  `Generated: ${summary.generatedAt}`,
  `Mode: ${summary.mode}`,
  `Demo milestone: client handoff acceptance bar`,
  "",
  "## Summary",
  "",
  `- Total cases: ${summary.totalCases}`,
  `- Average response quality score: ${summary.averageScore}/10`,
  `- Responses scoring 8+: ${summary.percentAtEightOrHigher}%`,
  `- Hard failures: ${summary.hardFailureCount}`,
  `- Known catalog fact rate: ${summary.knownFactRate}%`,
  `- Unknown-data fallback rate: ${summary.unknownFallbackRate}%`,
  `- Unsafe/out-of-scope safe handling rate: ${summary.unsafeRefusalRate}%`,
  "",
  "## Dashboard Signals Created",
  "",
  `- Conversation starts: ${summary.dashboard.conversationStarts}`,
  `- Total messages: ${summary.dashboard.totalMessages}`,
  `- Unknown-answer rate: ${summary.dashboard.unknownAnswerRate}%`,
  `- Objections: ${summary.dashboard.objectionsCount}`,
  `- Repeated questions: ${summary.dashboard.repeatedQuestionsCount}`,
  `- Weak-description signals: ${summary.dashboard.weakDescriptionSignals}`,
  "",
  "## Failed Cases",
  "",
  failed.length
    ? failed.map((item) => `- ${item.id}: score ${item.evaluation.score}, findings ${[...item.evaluation.findings, ...item.evaluation.hardFailures].join(", ")}`).join("\n")
    : "- None",
  "",
  "## Case Matrix",
  "",
  "| Case | Product | Kind | Score | Fallback | Objection | Findings |",
  "| --- | --- | --- | ---: | --- | --- | --- |",
  ...summary.results.map((item) => {
    const findings = [...item.evaluation.findings, ...item.evaluation.hardFailures].join(", ") || "none";
    return `| ${item.id} | ${item.productSlug} | ${item.kind} | ${item.evaluation.score} | ${item.fallbackReason ?? "none"} | ${item.detectedObjection ?? "none"} | ${findings} |`;
  }),
  "",
];

writeFileSync(reportPath, `${lines.join("\n")}\n`, "utf8");
writeFileSync(jsonReportPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
console.log(`Wrote ${reportPath}`);
console.log(`Wrote ${jsonReportPath}`);
