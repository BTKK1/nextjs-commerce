"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDashboardUser } from "@/lib/auth/require-user";
import { canManageGlobalAgent } from "@/lib/auth/roles";
import { validateSystemPrompt } from "@/lib/agent/prompt-validation";
import { writeGlobalAgentConfig } from "@/lib/agent/global-config";
import { isModelAvailableForProvider, isProductAgentProvider } from "@/lib/ai/model-catalog";

function value(formData: FormData, name: string): string {
  const item = formData.get(name);
  return typeof item === "string" ? item.trim() : "";
}

function finish(kind: "notice" | "error", message: string): never {
  redirect(`/dashboard/platform?${kind}=${encodeURIComponent(message)}#dashboard-feedback`);
}

export async function saveGlobalAgentAction(formData: FormData) {
  const identity = await requireDashboardUser();
  if (!canManageGlobalAgent(identity.role)) redirect("/dashboard?error=founder_access_required");
  const systemPrompt = value(formData, "system_prompt");
  const developerPrompt = value(formData, "developer_prompt");
  const providerValue = value(formData, "model_provider");
  if (!isProductAgentProvider(providerValue)) finish("error", "Choose an available AI model.");
  const modelProvider = providerValue;
  const modelName = value(formData, "model_name");
  if (systemPrompt.length < 40 || systemPrompt.length > 16_000) finish("error", "Core rules must be between 40 and 16,000 characters.");
  if (developerPrompt.length > 8_000) finish("error", "Sales instructions must be 8,000 characters or fewer.");
  if (!validateSystemPrompt(systemPrompt).valid) finish("error", "Nbeh's required accuracy and safety rules must remain in the core rules.");
  if (!isModelAvailableForProvider(modelProvider, modelName)) finish("error", "Choose an available AI model.");
  try {
    await writeGlobalAgentConfig({ systemPrompt, developerPrompt, modelProvider, modelName, updatedAt: new Date().toISOString(), updatedBy: identity.email });
  } catch (error) {
    console.error("[nbeh] save_global_agent_failed", error instanceof Error ? error.message : "unknown error");
    finish("error", "The global agent could not be saved. The previous configuration is still active.");
  }
  revalidatePath("/dashboard", "layout");
  finish("notice", "Your global model and sales instructions are now active across Nbeh agents.");
}
