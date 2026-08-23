import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import type { PromptVersionRow } from "@/lib/supabase/types";

export interface LocalAgentAdminState {
  schemaVersion: 1;
  merchantId: string;
  activeVersionId: string | null;
  versions: PromptVersionRow[];
  qaRuns: Array<Record<string, unknown>>;
  auditLogs: Array<Record<string, unknown>>;
}

interface LoadedState {
  state: LocalAgentAdminState;
  etag: string | null;
}

const localRuntimeDirectory = !process.env.VERCEL && process.env.NBEH_LOCAL_ADMIN_DIR
  ? path.resolve(process.env.NBEH_LOCAL_ADMIN_DIR)
  : path.join(process.cwd(), ".demo-runtime");
const localPath = path.join(localRuntimeDirectory, "agent-admin-state.enc");
const localKeyPath = path.join(localRuntimeDirectory, "agent-admin.key");

function blobPath(merchantId: string): string {
  return `private/nbeh/agent-admin-${merchantId.replace(/[^a-zA-Z0-9-]/g, "")}.enc`;
}

function emptyState(merchantId: string): LocalAgentAdminState {
  return { schemaVersion: 1, merchantId, activeVersionId: null, versions: [], qaRuns: [], auditLogs: [] };
}

export function normalizeBlobEtag(value: string): string {
  const trimmed = value.trim().replace(/^W\//, "");
  return trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
}

function encryptionKey(): Buffer {
  const secret = process.env.GLOBAL_AGENT_CONFIG_SECRET || process.env.FOUNDER_SESSION_SECRET;
  if (secret) return createHash("sha256").update(secret).digest();
  if (process.env.VERCEL) throw new Error("Local agent administration encryption is not configured.");
  try {
    const stored = readFileSync(localKeyPath);
    if (stored.length === 32) return stored;
  } catch {
    // Create a machine-local key below.
  }
  const generated = randomBytes(32);
  mkdirSync(path.dirname(localKeyPath), { recursive: true });
  try {
    writeFileSync(localKeyPath, generated, { mode: 0o600, flag: "wx" });
    return generated;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      const stored = readFileSync(localKeyPath);
      if (stored.length === 32) return stored;
    }
    throw error;
  }
}

function encode(state: LocalAgentAdminState): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(state))), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decode(contents: string, merchantId: string): LocalAgentAdminState {
  const [ivValue, tagValue, encryptedValue] = contents.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid local agent administration state.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]);
  const parsed = JSON.parse(plaintext.toString("utf8")) as Partial<LocalAgentAdminState>;
  if (parsed.schemaVersion !== 1 || parsed.merchantId !== merchantId) throw new Error("Local agent administration state does not match this merchant.");
  return {
    schemaVersion: 1,
    merchantId,
    activeVersionId: typeof parsed.activeVersionId === "string" ? parsed.activeVersionId : null,
    versions: Array.isArray(parsed.versions) ? parsed.versions : [],
    qaRuns: Array.isArray(parsed.qaRuns) ? parsed.qaRuns : [],
    auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
  };
}

async function loadState(merchantId: string): Promise<LoadedState> {
  if (process.env.VERCEL) {
    const result = await get(blobPath(merchantId), { access: "private", useCache: false });
    if (!result?.stream) return { state: emptyState(merchantId), etag: null };
    return { state: decode(await new Response(result.stream).text(), merchantId), etag: normalizeBlobEtag(result.blob.etag) };
  }
  try {
    return { state: decode(await fs.readFile(localPath, "utf8"), merchantId), etag: null };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { state: emptyState(merchantId), etag: null };
    throw error;
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function readLocalAgentAdminState(merchantId: string): Promise<LocalAgentAdminState> {
  return clone((await loadState(merchantId)).state);
}

export async function mutateLocalAgentAdminState<T>(merchantId: string, mutator: (state: LocalAgentAdminState) => T): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const loaded = await loadState(merchantId);
    const next = clone(loaded.state);
    const result = mutator(next);
    const contents = encode(next);
    if (!process.env.VERCEL) {
      await fs.mkdir(path.dirname(localPath), { recursive: true });
      const temporary = `${localPath}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
      await fs.writeFile(temporary, contents, { encoding: "utf8", mode: 0o600 });
      await fs.rename(temporary, localPath);
      return result;
    }
    try {
      await put(blobPath(merchantId), contents, {
        access: "private",
        addRandomSuffix: false,
        contentType: "application/octet-stream",
        ...(loaded.etag ? { ifMatch: loaded.etag } : { allowOverwrite: false }),
      });
      return result;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("Local agent administration state changed concurrently. Please retry.");
}
