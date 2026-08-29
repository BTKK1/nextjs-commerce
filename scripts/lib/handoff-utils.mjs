import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const root = process.cwd();
export const previewManager = "C:\\Users\\PC\\codex-ops\\preview-server-manager.ps1";
export const preferredPreviewPort = process.env.PREVIEW_PREFERRED_PORT || "3002";

export function previewCommand() {
  return process.env.PLAYWRIGHT_USE_BUILD_SERVER === "1" ? "pnpm exec next start" : "pnpm exec next dev --webpack";
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

export function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeMarkdown(path, lines) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

export function loadLocalEnv() {
  const output = {};
  for (const filename of [".env.local", ".env"]) {
    const path = join(root, filename);
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

export function baseHandoffEnv(extra = {}) {
  const localEnv = loadLocalEnv();
  const mode = "live";
  return {
    ...localEnv,
    ...process.env,
    AGENT_MODE: mode,
    AGENT_QUALITY_MODE: extra.AGENT_QUALITY_MODE || mode,
    NEXT_PUBLIC_DEMO_MODE: extra.NEXT_PUBLIC_DEMO_MODE ?? process.env.NEXT_PUBLIC_DEMO_MODE ?? "false",
    DATA_BACKEND: extra.DATA_BACKEND ?? process.env.DATA_BACKEND ?? "supabase",
    NEXTAUTH_SECRET: "handoff-local-secret",
    SUPABASE_AGENT_ENABLED: extra.SUPABASE_AGENT_ENABLED ?? process.env.SUPABASE_AGENT_ENABLED ?? "true",
    SALES_AGENT_MODEL: process.env.CONTINUOUS_TEST_MODEL || "z-ai/glm-5.3-flash",
    SALES_AGENT_DISABLE_FALLBACKS: "true",
    PRODUCT_AGENT_DISABLE_FALLBACKS: "true",
    OPENROUTER_MODEL: process.env.CONTINUOUS_TEST_MODEL || "z-ai/glm-5.3-flash",
    ...extra,
  };
}

function psQuote(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function waitForUrl(url, timeoutMs = 120_000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Preview server did not become healthy at ${url}: ${lastError instanceof Error ? lastError.message : "timeout"}`);
}

export async function acquirePreviewServer(env = baseHandoffEnv()) {
  if (process.env.PLAYWRIGHT_BASE_URL) {
    return { url: process.env.PLAYWRIGHT_BASE_URL, action: "provided", cleanup: async () => undefined };
  }

  const command = env.PLAYWRIGHT_USE_BUILD_SERVER === "1" || process.env.PLAYWRIGHT_USE_BUILD_SERVER === "1"
    ? "pnpm exec next start"
    : previewCommand();

  if (command.includes("next start")) {
    stopLocalPreviewServer();
  }

  if (process.platform === "win32" && existsSync(previewManager)) {
    const acquire = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        previewManager,
        "acquire",
        "-ProjectRoot",
        root,
        "-Command",
        command,
        "-PreferredPort",
        preferredPreviewPort,
        "-Json",
      ],
      {
        cwd: root,
        env,
        encoding: "utf8",
      },
    );

    if (acquire.error) throw acquire.error;
    if (acquire.status !== 0) {
      process.stdout.write(acquire.stdout || "");
      process.stderr.write(acquire.stderr || "");
      throw new Error("Failed to acquire preview server");
    }

    const result = JSON.parse(acquire.stdout.trim());
    console.log(`Preview server ${result.action}: ${result.url}`);
    await waitForUrl(result.url);
    return { url: result.url, action: result.action, cleanup: async () => undefined };
  }

  const url = "http://127.0.0.1:3100";
  const childArgs = command.includes("next start")
    ? ["exec", "next", "start", "-H", "127.0.0.1", "-p", "3100"]
    : ["exec", "next", "dev", "--webpack", "-H", "127.0.0.1", "-p", "3100"];
  const child = spawn("pnpm", childArgs, {
    cwd: root,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  await waitForUrl(url);
  return {
    url,
    action: "started",
    cleanup: async () => {
      child.kill();
    },
  };
}

export function stopLocalPreviewServer() {
  if (process.env.CI || process.platform !== "win32" || !existsSync(previewManager)) {
    console.log("No local preview server stop needed.");
    return;
  }

  const script = `
$root = ${psQuote(root)}
$registryPath = Join-Path $HOME '.openclaw\\preview-servers.json'
if (-not (Test-Path -LiteralPath $registryPath)) {
  Write-Output 'No preview registry found.'
  exit 0
}
$registry = Get-Content -LiteralPath $registryPath -Raw | ConvertFrom-Json
$entries = @($registry.entries)
$stopped = @()
foreach ($entry in $entries) {
  if ([string]$entry.projectRoot -ne $root -or -not $entry.pid) { continue }
  $pidValue = [int]$entry.pid
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$pidValue" -ErrorAction SilentlyContinue
  if ($null -eq $process) {
    $entry.status = 'stale'
    $entry.notes = (($entry.notes, 'stale before handoff build') | Where-Object { $_ }) -join '; '
    continue
  }
  $commandLine = [string]$process.CommandLine
  if ($commandLine.ToLowerInvariant().Contains($root.ToLowerInvariant()) -and $commandLine -match '(?i)(next|pnpm|npm|yarn)') {
    Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
    $entry.status = 'stale'
    $entry.notes = (($entry.notes, 'stopped by handoff-check before production build') | Where-Object { $_ }) -join '; '
    $stopped += $pidValue
  }
}
$registry.entries = $entries
$registry.updatedAt = (Get-Date).ToUniversalTime().ToString('o')
$registry | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $registryPath -Encoding UTF8
if ($stopped.Count -gt 0) {
  Write-Output "Stopped preview server PID(s): $($stopped -join ', ')"
} else {
  Write-Output 'No matching preview server process was running.'
}
`;

  const stop = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    {
      cwd: root,
      encoding: "utf8",
      stdio: "pipe",
    },
  );

  process.stdout.write(stop.stdout || "");
  process.stderr.write(stop.stderr || "");
  if (stop.error) throw stop.error;
  if (stop.status !== 0) throw new Error("Failed to stop local preview server");
}

export function runPnpm(label, args, env = baseHandoffEnv()) {
  console.log(`\n==> ${label}`);
  const run =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", ["pnpm", ...args].join(" ")], {
          cwd: root,
          env,
          stdio: "inherit",
        })
      : spawnSync("pnpm", args, {
          cwd: root,
          env,
          stdio: "inherit",
        });

  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`${label} failed with status ${run.status ?? 1}`);
}
