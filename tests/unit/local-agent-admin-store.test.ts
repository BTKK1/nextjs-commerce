import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const merchantId = "merchant-local-store-test";
let runtimeDirectory = "";

describe("local agent administration store", () => {
  beforeEach(async () => {
    runtimeDirectory = await mkdtemp(join(tmpdir(), "nbeh-agent-admin-"));
    vi.stubEnv("NBEH_LOCAL_ADMIN_DIR", runtimeDirectory);
    vi.stubEnv("GLOBAL_AGENT_CONFIG_SECRET", "unit-test-agent-admin-secret");
    vi.stubEnv("FOUNDER_SESSION_SECRET", "");
    vi.stubEnv("VERCEL", "");
    vi.resetModules();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.resetModules();
    await rm(runtimeDirectory, { recursive: true, force: true });
  });

  it("encrypts and persists prompt versions, active selection, QA evidence, and audit records", async () => {
    const { mutateLocalAgentAdminState, readLocalAgentAdminState } = await import("@/lib/agent/local-admin-store");
    const now = new Date().toISOString();

    await mutateLocalAgentAdminState(merchantId, (state) => {
      state.activeVersionId = "version-2";
      state.versions.push({
        id: "version-2",
        agent_config_id: "agent-config",
        merchant_id: merchantId,
        version_number: 2,
        title: "Draft v2",
        system_prompt: "Use the selected product facts and never invent missing information.",
        developer_prompt: null,
        change_note: "Regression test",
        test_result: { passed: true },
        status: "published",
        created_by: null,
        published_by: null,
        created_at: now,
        published_at: now,
      });
      state.qaRuns.push({ id: "qa-1", prompt_version_id: "version-2", status: "passed" });
      state.auditLogs.push({ id: "audit-1", action: "prompt_version_published" });
    });

    const stored = await readLocalAgentAdminState(merchantId);
    expect(stored.activeVersionId).toBe("version-2");
    expect(stored.versions[0]?.system_prompt).toContain("selected product facts");
    expect(stored.qaRuns).toEqual([expect.objectContaining({ id: "qa-1", status: "passed" })]);
    expect(stored.auditLogs).toEqual([expect.objectContaining({ action: "prompt_version_published" })]);

    const encrypted = await readFile(join(runtimeDirectory, "agent-admin-state.enc"), "utf8");
    expect(encrypted).not.toContain("selected product facts");
    expect(encrypted.split(".")).toHaveLength(3);
  });

  it("rejects state encrypted for a different merchant", async () => {
    const { mutateLocalAgentAdminState, readLocalAgentAdminState } = await import("@/lib/agent/local-admin-store");
    await mutateLocalAgentAdminState(merchantId, (state) => {
      state.auditLogs.push({ id: "audit-1" });
    });

    await expect(readLocalAgentAdminState("another-merchant")).rejects.toThrow("does not match this merchant");
  });

  it("normalizes HTTP ETag headers for Blob conditional writes", async () => {
    const { normalizeBlobEtag } = await import("@/lib/agent/local-admin-store");
    expect(normalizeBlobEtag('"abc123"')).toBe("abc123");
    expect(normalizeBlobEtag('W/"abc123"')).toBe("abc123");
    expect(normalizeBlobEtag("abc123")).toBe("abc123");
  });
});
