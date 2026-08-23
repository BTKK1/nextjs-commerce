import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DEFAULT_AGENT_SYSTEM_PROMPT } from "@/lib/agent/default-prompt";
import { getModelConfig } from "@/lib/ai/model-config";
import { get, put } from "@vercel/blob";
import { resolveDataBackend } from "@/lib/backend/mode";
import { createServiceClient, hasSupabaseServiceConfig } from "@/utils/supabase/server";
import { DEMO_MERCHANT_ID } from "@/lib/supabase/constants";

export interface GlobalAgentConfig {
  systemPrompt: string;
  developerPrompt: string;
  modelProvider: "openrouter" | "deepseek-direct";
  modelName: string;
  updatedAt: string | null;
  updatedBy: string | null;
  source: "default" | "encrypted_file" | "supabase";
}

interface StoredGlobalConfig extends Omit<GlobalAgentConfig, "source"> { version: 1 }

const configPath = path.join(process.cwd(), ".demo-runtime", "global-agent-config.enc");
const blobPath = "private/nbeh/global-agent-config.enc";

function defaultGlobalConfig(): GlobalAgentConfig {
  const model = getModelConfig();
  return {
    systemPrompt: DEFAULT_AGENT_SYSTEM_PROMPT,
    developerPrompt: "Answer directly and keep most replies to one or two short conversational lines. Ask at most one useful question only when it materially improves the recommendation; never force a question, CTA, or sale.",
    modelProvider: model.provider,
    modelName: model.model,
    updatedAt: null,
    updatedBy: null,
    source: "default",
  };
}

function key(): Buffer | null {
  const secret = process.env.GLOBAL_AGENT_CONFIG_SECRET || process.env.FOUNDER_SESSION_SECRET;
  return secret ? createHash("sha256").update(secret).digest() : null;
}

function decrypt(contents: string, encryptionKey: Buffer): StoredGlobalConfig {
  const [ivValue, tagValue, encryptedValue] = contents.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid global agent configuration.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as StoredGlobalConfig;
}

export async function readGlobalAgentConfig(): Promise<GlobalAgentConfig> {
  if (resolveDataBackend() === "supabase") {
    if (!hasSupabaseServiceConfig()) throw new Error("Supabase global agent governance is selected but its server credentials are not configured.");
    const { data, error } = await createServiceClient().from("platform_agent_config").select("*").eq("singleton_key", "global").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("The global Nbeh agent configuration has not been seeded in Supabase.");
    return {
      systemPrompt: String(data.system_prompt),
      developerPrompt: String(data.developer_prompt ?? ""),
      modelProvider: data.model_provider === "deepseek-direct" ? "deepseek-direct" : "openrouter",
      modelName: String(data.model_name),
      updatedAt: data.updated_at ? String(data.updated_at) : null,
      updatedBy: data.updated_by ? String(data.updated_by) : null,
      source: "supabase",
    };
  }
  const encryptionKey = key();
  if (!encryptionKey) return defaultGlobalConfig();
  try {
    let contents: string;
    if (process.env.VERCEL) {
      const result = await get(blobPath, { access: "private" });
      if (!result?.stream) return defaultGlobalConfig();
      contents = await new Response(result.stream).text();
    } else {
      contents = await fs.readFile(configPath, "utf8");
    }
    const stored = decrypt(contents, encryptionKey);
    return { ...stored, source: "encrypted_file" };
  } catch {
    return defaultGlobalConfig();
  }
}

export async function writeGlobalAgentConfig(input: Omit<StoredGlobalConfig, "version">): Promise<void> {
  if (resolveDataBackend() === "supabase") {
    if (!hasSupabaseServiceConfig()) throw new Error("Supabase global agent governance is selected but its server credentials are not configured.");
    const { error } = await createServiceClient().rpc("update_global_agent_config_atomic", {
      audit_merchant_id: DEMO_MERCHANT_ID,
      target_system_prompt: input.systemPrompt,
      target_developer_prompt: input.developerPrompt,
      target_model_provider: input.modelProvider,
      target_model_name: input.modelName,
      actor_email: input.updatedBy,
      change_time: input.updatedAt,
    });
    if (error) throw error;
    return;
  }
  const encryptionKey = key();
  if (!encryptionKey) throw new Error("Global agent configuration encryption is not configured.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const plaintext = Buffer.from(JSON.stringify({ ...input, version: 1 } satisfies StoredGlobalConfig));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const encoded = `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
  if (process.env.VERCEL) {
    await put(blobPath, encoded, { access: "private", addRandomSuffix: false, contentType: "application/octet-stream", allowOverwrite: true });
    return;
  }
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  const temporary = `${configPath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, encoded, { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporary, configPath);
}
