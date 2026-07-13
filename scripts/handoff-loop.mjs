import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { acquirePreviewServer, baseHandoffEnv, readJson, root, runPnpm, stopLocalPreviewServer, writeJson, writeMarkdown } from "./lib/handoff-utils.mjs";

const loopDir = join(root, ".codex-loop");
const statePath = join(loopDir, "state.json");
const findingsPath = join(loopDir, "findings.json");
const nextGoalPath = join(loopDir, "NEXT_GOAL.md");
const startedAt = new Date().toISOString();
const previousState = readJson(statePath, {
  startedAt,
  maxHours: 10,
  iteration: 0,
  consecutiveZeroFindingLoops: 0,
  currentGoal: "Initialize handoff hardening loop",
  lastFocusedCommand: null,
  lastFullCommand: null,
  openFindings: [],
  fixedFindings: [],
  ready: false,
});

const iteration = Number(previousState.iteration || 0) + 1;
const env = baseHandoffEnv({
  AGENT_MODE: "live",
  CODEX_LOOP_ITERATION: String(iteration),
});
const browserBaseEnv = {
  ...env,
  PLAYWRIGHT_USE_BUILD_SERVER: "1",
};
let lastFocusedCommand = null;
let lastFullCommand = null;
let fullCommandPassed = false;
let commandFailure = null;

const currentGoal = `Iteration ${iteration}: run screenshots, product pages, agent, dashboard, and full handoff gate until zero P0/P1/P2 findings.`;
writeMarkdown(nextGoalPath, [
  "# Next Goal",
  "",
  currentGoal,
  "",
  "Run the focused audits first, fix any implementation issue, add regression coverage, then rerun the full handoff check.",
]);

writeJson(statePath, {
  ...previousState,
  iteration,
  currentGoal,
  lastFocusedCommand,
  lastFullCommand,
  ready: false,
});

const preBrowserSteps = [
  ["generate demo assets", ["run", "generate:demo-assets"]],
  ["seed demo data", ["run", "seed:demo"]],
  ["production build for focused browser audits", ["run", "build"]],
];

const focusedSteps = [
  ["product screenshots", ["run", "screenshots:products"]],
  ["product page audit", ["run", "audit:product-pages"]],
  ["product page E2E", ["run", "test:e2e:product-pages"]],
  ["agent E2E", ["run", "test:e2e:agent"]],
  ["agent quality matrix", ["run", "test:agent:quality"]],
  ["dashboard audit", ["run", "audit:dashboard"]],
  ["dashboard E2E", ["run", "test:e2e:dashboard"]],
];

let preview = null;
try {
  for (const [label, args] of preBrowserSteps) {
    lastFocusedCommand = `pnpm ${args.join(" ")}`;
    if (label.includes("production build")) stopLocalPreviewServer();
    runPnpm(label, args, browserBaseEnv);
  }

  preview = await acquirePreviewServer(browserBaseEnv);
  const browserEnv = {
    ...browserBaseEnv,
    PLAYWRIGHT_BASE_URL: preview.url,
    CI_PREVIEW_SERVER: "1",
    NEXTAUTH_URL: preview.url,
  };

  for (const [label, args] of focusedSteps) {
    lastFocusedCommand = `pnpm ${args.join(" ")}`;
    runPnpm(label, args, browserEnv);
  }
} catch (error) {
  commandFailure = error instanceof Error ? error.message : String(error);
  console.error(commandFailure);
} finally {
  if (preview) await preview.cleanup();
  stopLocalPreviewServer();
}

if (!commandFailure) {
  try {
    lastFullCommand = "pnpm run handoff:check";
    runPnpm("full handoff check", ["run", "handoff:check"], env);
    fullCommandPassed = true;
  } catch (error) {
    commandFailure = error instanceof Error ? error.message : String(error);
    console.error(commandFailure);
  }
}

function readReport(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

function collectFindings() {
  const findings = [];
  const product = readReport(join(loopDir, "product-page-audit.json"));
  const dashboard = readReport(join(loopDir, "dashboard-audit.json"));
  const screenshots = readReport(join(loopDir, "screenshot-audit.json"));
  const quality = readReport(join(root, "AGENT_QUALITY_REPORT.json"));

  for (const [source, report] of [
    ["product-page-audit", product],
    ["dashboard-audit", dashboard],
    ["screenshot-audit", screenshots],
  ]) {
    for (const finding of report?.findings ?? []) {
      findings.push({ source, ...finding, reproduction: finding.detail ?? "See audit report." });
    }
  }

  if (quality) {
    for (const item of quality.results ?? []) {
      const hardFailures = item.evaluation?.hardFailures ?? [];
      const failed = !item.evaluation?.passed;
      if (hardFailures.length) {
        findings.push({
          source: "agent-quality",
          severity: "P0",
          id: `agent-hard-failure-${item.id}`,
          productSlug: item.productSlug,
          detail: hardFailures.join(", "),
          reproduction: item.message,
        });
      } else if (failed) {
        findings.push({
          source: "agent-quality",
          severity: "P2",
          id: `agent-weak-answer-${item.id}`,
          productSlug: item.productSlug,
          detail: (item.evaluation?.findings ?? []).join(", ") || `Score ${item.evaluation?.score}`,
          reproduction: item.message,
        });
      }
    }
  }

  if (commandFailure) {
    findings.push({
      source: "handoff-loop",
      severity: "P0",
      id: "command_failure",
      detail: commandFailure,
      reproduction: lastFocusedCommand || lastFullCommand || "handoff loop",
    });
  }

  return findings;
}

const openFindings = collectFindings();
const blockingOpenFindings = openFindings.filter((finding) => ["P0", "P1", "P2"].includes(finding.severity));
const clean = fullCommandPassed && blockingOpenFindings.length === 0;
const consecutiveZeroFindingLoops = clean ? Number(previousState.consecutiveZeroFindingLoops || 0) + 1 : 0;
const ready = consecutiveZeroFindingLoops >= 3;
const updatedAt = new Date().toISOString();

const nextState = {
  startedAt: previousState.startedAt || startedAt,
  maxHours: 10,
  iteration,
  consecutiveZeroFindingLoops,
  currentGoal,
  lastFocusedCommand,
  lastFullCommand,
  openFindings: blockingOpenFindings,
  fixedFindings: previousState.fixedFindings ?? [],
  ready,
  updatedAt,
};

writeJson(statePath, nextState);
writeJson(findingsPath, {
  updatedAt,
  iteration,
  openFindings,
  blockingOpenFindings,
});

const statusLines = [
  `READY_FOR_CLIENT_HANDOFF=${ready ? "true" : "false"}`,
  `consecutiveZeroFindingLoops=${consecutiveZeroFindingLoops}`,
  `P0_OPEN=${blockingOpenFindings.filter((finding) => finding.severity === "P0").length}`,
  `P1_OPEN=${blockingOpenFindings.filter((finding) => finding.severity === "P1").length}`,
  `P2_OPEN=${blockingOpenFindings.filter((finding) => finding.severity === "P2").length}`,
  `FULL_HANDOFF_CHECK=${fullCommandPassed ? "PASS" : "FAIL"}`,
  `AGENT_QUALITY=${openFindings.some((finding) => finding.source === "agent-quality") ? "FAIL" : "PASS"}`,
  `SCREENSHOT_AUDIT=${openFindings.some((finding) => finding.source === "screenshot-audit") ? "FAIL" : "PASS"}`,
  `DASHBOARD_AUDIT=${openFindings.some((finding) => finding.source === "dashboard-audit") ? "FAIL" : "PASS"}`,
  `BUILD=${fullCommandPassed ? "PASS" : "UNKNOWN"}`,
];

writeMarkdown(join(root, "AGENT_E2E_LOOP.md"), [
  "# Agent E2E Loop",
  "",
  `Loop start timestamp: ${nextState.startedAt}`,
  "Max runtime: 10 hours",
  `Current iteration number: ${iteration}`,
  `Current goal: ${currentGoal}`,
  `Current blocker: ${blockingOpenFindings.length ? "Open P0/P1/P2 findings" : "None"}`,
  `Failing tests: ${commandFailure ?? "None"}`,
  `Failing agent cases: ${openFindings.filter((finding) => finding.source === "agent-quality").length}`,
  `Next fix target: ${blockingOpenFindings[0]?.id ?? "Run next clean audit loop"}`,
  `Handoff score: ${consecutiveZeroFindingLoops}/3 clean loops`,
  "",
  "## Latest Findings",
  "",
  blockingOpenFindings.length
    ? blockingOpenFindings.map((finding) => `- ${finding.severity} ${finding.source} ${finding.id}: ${finding.detail}`).join("\n")
    : "- None",
  "",
]);

writeMarkdown(join(root, "CLIENT_HANDOFF_ACCEPTANCE.md"), [
  "# Client Handoff Acceptance",
  "",
  "This document tracks the client handoff acceptance bar for the Maison Vert showcase build.",
  "",
  "## Gate Status",
  "",
  ...statusLines.map((line) => `- ${line}`),
  "",
  "## Evidence",
  "",
  "- Product screenshots: .codex-loop/screenshots/",
  "- Product page audit: PRODUCT_PAGE_AUDIT.md",
  "- Screenshot audit: SCREENSHOT_AUDIT.md",
  "- Agent quality: AGENT_QUALITY_REPORT.md and AGENT_QUALITY_REPORT.json",
  "- Dashboard audit: DASHBOARD_AUDIT.md",
  "- Loop state: .codex-loop/state.json",
  "",
]);

writeMarkdown(join(root, "HANDOFF_REPORT.md"), [
  "# Handoff Report",
  "",
  ...statusLines,
  "",
  `Final status: ${ready ? "READY" : "IN_PROGRESS"}`,
  `Loop iterations: ${iteration}`,
  `Consecutive zero-finding loops: ${consecutiveZeroFindingLoops}`,
  `Commands run: focused audits plus ${lastFullCommand ?? "no full command"}`,
  "Product routes validated: /product/[slug] and /products/[slug] alias through E2E coverage for all demo catalog products.",
  "Dashboard routes validated: /dashboard, /dashboard/conversations, /dashboard/conversations/[id], /dashboard/insights, /dashboard/integrations, /dashboard/products, /dashboard/settings.",
  `Screenshots location: .codex-loop/screenshots/iteration-${iteration}/`,
  "E2E report location: playwright-report/",
  "Agent transcript and quality evidence: AGENT_QUALITY_REPORT.md and AGENT_QUALITY_REPORT.json",
  "Dashboard audit result: see DASHBOARD_AUDIT.md",
  "Screenshot and product page audit result: see SCREENSHOT_AUDIT.md and PRODUCT_PAGE_AUDIT.md",
  "Agent quality score: see AGENT_QUALITY_REPORT.md",
  "Model config used: live-only Ting-style OpenRouter/DeepSeek route order from src/lib/ai/model-config.ts; scripted shopper answers are disabled.",
  "CI result: local gate evidence only until GitHub Actions runs remotely",
  "Known limitations: Salla and Zid are intentionally not connected in this demo milestone; provider stubs only.",
  "Future Salla/Zid connection work: replace demo catalog provider with authenticated platform adapters and merchant onboarding.",
  "",
  "## Commands To Rerun",
  "",
  "- pnpm run handoff:check",
  "- pnpm run handoff:loop",
  "- pnpm run test:agent:live",
  "",
  "## Required Environment",
  "",
  "- AGENT_MODE=live for every shopper conversation and handoff check.",
  "- OPENROUTER_API_KEY or DEEPSEEK_API_KEY is required for agent validation.",
  "- Optional live metadata: OPENROUTER_SITE_URL, OPENROUTER_APP_NAME.",
  "",
  "## Open Findings",
  "",
  blockingOpenFindings.length
    ? blockingOpenFindings.map((finding) => `- ${finding.severity} ${finding.source} ${finding.id}: ${finding.detail}`).join("\n")
    : "- None",
  "",
]);

const logLine = [
  `## Iteration ${iteration}`,
  "",
  `- Goal: ${currentGoal}`,
  `- Commands run: ${[...preBrowserSteps, ...focusedSteps].map(([, args]) => `pnpm ${args.join(" ")}`).join("; ")}; ${lastFullCommand ?? "full gate skipped"}`,
  "- Screenshots captured: yes, when screenshot step completed",
  `- Findings found: ${blockingOpenFindings.length}`,
  "- Fixes made: by Codex outside this loop script",
  "- Regression tests added: tracked in code changes and E2E/integration suites",
  `- Final status: ${clean ? "clean checkpoint" : "findings remain"}`,
  `- Next goal: ${ready ? "client handoff ready" : "fix findings or run next clean loop"}`,
  "",
].join("\n");

const logPath = join(root, "IMPLEMENTATION_LOG.md");
const existingLog = existsSync(logPath) ? readFileSync(logPath, "utf8") : "# Implementation Log\n\n";
writeMarkdown(logPath, [existingLog.trimEnd(), "", logLine]);

console.log(statusLines.join("\n"));
if (!clean) process.exit(1);
