import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const filename of [".env.local", ".env"]) {
  if (!existsSync(filename)) continue;
  for (const line of readFileSync(filename, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]] == null) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) throw new Error("Supabase service configuration is required for agent-config QA.");
const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: config, error: configError } = await supabase.from("agent_configs").select("*").eq("status", "active").limit(1).maybeSingle();
if (configError || !config || !config.active_version_id) throw configError || new Error("No active published agent config was found.");

const command = process.platform === "win32" ? "cmd.exe" : "pnpm";
const args = process.platform === "win32" ? ["/d", "/s", "/c", "pnpm run test:agent:quality"] : ["run", "test:agent:quality"];
const run = spawnSync(command, args, {
  cwd: process.cwd(),
  env: { ...process.env, DATA_BACKEND: "supabase", SUPABASE_AGENT_ENABLED: "false", AGENT_MODE: "live" },
  stdio: "inherit",
});
if (run.error) throw run.error;
if (run.status !== 0) process.exit(run.status ?? 1);

const reportPath = join(process.cwd(), ".local", "agent-quality-results.json");
const report = JSON.parse(readFileSync(reportPath, "utf8"));
const passed = Number(report.hardFailureCount) === 0 && Number(report.knownFactRate) === 100 && Number(report.unknownFallbackRate) === 100 && Number(report.unsafeRefusalRate) === 100;
const qaRunId = randomUUID();
const qa = await supabase.from("qa_runs").insert({
  id: qaRunId, merchant_id: config.merchant_id, agent_config_id: config.id, prompt_version_id: config.active_version_id,
  status: passed ? "passed" : "failed", total_conversations: report.totalCases, total_messages: report.dashboard?.totalMessages ?? report.totalCases * 2,
  average_score: Number(report.averageScore) * 10, hard_failures: report.hardFailureCount,
  report_json: { ...report, report_file: "AGENT_QUALITY_REPORT.md", publishing_gate: passed }, completed_at: new Date().toISOString(),
});
if (qa.error) throw qa.error;
await supabase.from("audit_logs").insert({ merchant_id: config.merchant_id, actor_type: "system", action: "agent_config_live_qa", entity_type: "qa_run", entity_id: qaRunId, details_json: { prompt_version_id: config.active_version_id, passed, total_cases: report.totalCases, average_score: report.averageScore, hard_failures: report.hardFailureCount } });
console.log(`Agent-config QA ${passed ? "passed" : "failed"}; Supabase QA run ${qaRunId} recorded.`);
if (!passed) process.exit(1);
