"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/utils/supabase/server";
import { requireDashboardUser } from "@/lib/auth/require-user";
import { canManageProducts } from "@/lib/auth/roles";
import { writeAuditLog } from "@/lib/audit/audit-log";
import { resolveDataBackend } from "@/lib/backend/mode";
import { mutateDatabase } from "@/lib/storage/json-store";

async function context(formData: FormData) {
  const identity = await requireDashboardUser();
  if (!canManageProducts(identity.role)) redirect("/dashboard?error=This%20role%20has%20read-only%20dashboard%20access");
  const conversationId = String(formData.get("conversation_id") ?? "");
  if (!conversationId) redirect("/dashboard/conversations?error=Conversation%20could%20not%20be%20identified");
  return { identity, conversationId, supabase: resolveDataBackend() === "supabase" ? createServiceClient() : null };
}

function feedback(conversationId: string, kind: "notice" | "error", message: string): never {
  redirect(`/dashboard/conversations/${encodeURIComponent(conversationId)}?${kind}=${encodeURIComponent(message)}#dashboard-feedback`);
}

function logFailure(action: string, error: unknown) {
  console.error(`[nbeh] ${action}_failed`, error instanceof Error ? error.message : "unknown error");
}

export async function rateConversationAction(formData: FormData) {
  const { identity, conversationId, supabase } = await context(formData);
  const rating = Number(formData.get("rating"));
  if (![1, 5].includes(rating)) feedback(conversationId, "error", "Choose Helpful or Needs review.");
  try {
    if (!supabase) {
      mutateDatabase((database) => {
        const message = [...database.messages].reverse().find((item) => item.conversationId === conversationId && item.role === "assistant");
        if (!message) throw new Error("Assistant message was not found.");
        message.qualityRating = rating;
        message.metadata = { ...(message.metadata ?? {}), reviewed_at: new Date().toISOString() };
      });
    } else {
      const { data: message, error: messageError } = await supabase.from("messages").select("id,metadata_json").eq("merchant_id", identity.merchantId).eq("conversation_id", conversationId).eq("sender_type", "assistant").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (messageError || !message) throw messageError ?? new Error("Assistant message was not found.");
      const metadata = message.metadata_json && typeof message.metadata_json === "object" ? message.metadata_json : {};
      const { error } = await supabase.from("messages").update({ metadata_json: { ...metadata, quality_rating: rating, reviewed_at: new Date().toISOString() } }).eq("id", message.id).eq("merchant_id", identity.merchantId);
      if (error) throw error;
    }
    await writeAuditLog({ merchantId: identity.merchantId, actorUserId: identity.userId, action: "conversation_quality_rated", entityType: "conversation", entityId: conversationId, details: { rating } });
  } catch (error) {
    logFailure("rate_conversation", error);
    feedback(conversationId, "error", "The rating could not be saved. Please try again.");
  }
  revalidatePath(`/dashboard/conversations/${conversationId}`);
  feedback(conversationId, "notice", rating === 5 ? "Marked as helpful." : "Marked for review.");
}

export async function addConversationNoteAction(formData: FormData) {
  const { identity, conversationId, supabase } = await context(formData);
  const note = String(formData.get("note") ?? "").trim().slice(0, 1200);
  if (note.length < 2) feedback(conversationId, "error", "Write a note before saving.");
  try {
    if (!supabase) {
      mutateDatabase((database) => {
        const conversation = database.conversations.find((item) => item.id === conversationId && item.merchantId === identity.merchantId);
        if (!conversation) throw new Error("Conversation was not found for this merchant.");
        conversation.metadata = { ...(conversation.metadata ?? {}), admin_note: note, admin_note_updated_at: new Date().toISOString() };
        conversation.updatedAt = new Date().toISOString();
      });
    } else {
      const { data: conversation, error: conversationError } = await supabase.from("conversations").select("metadata_json").eq("id", conversationId).eq("merchant_id", identity.merchantId).maybeSingle();
      if (conversationError || !conversation) throw conversationError ?? new Error("Conversation was not found for this merchant.");
      const metadata = conversation.metadata_json && typeof conversation.metadata_json === "object" ? conversation.metadata_json : {};
      const { error } = await supabase.from("conversations").update({ metadata_json: { ...metadata, admin_note: note, admin_note_updated_at: new Date().toISOString() } }).eq("id", conversationId).eq("merchant_id", identity.merchantId);
      if (error) throw error;
    }
    await writeAuditLog({ merchantId: identity.merchantId, actorUserId: identity.userId, action: "conversation_note_updated", entityType: "conversation", entityId: conversationId });
  } catch (error) {
    logFailure("save_conversation_note", error);
    feedback(conversationId, "error", "The note could not be saved. Your previous note is unchanged.");
  }
  revalidatePath(`/dashboard/conversations/${conversationId}`);
  feedback(conversationId, "notice", "Conversation note saved.");
}

export async function createConversationInsightAction(formData: FormData) {
  const { identity, conversationId, supabase } = await context(formData);
  const title = String(formData.get("title") ?? "").trim().slice(0, 180);
  const content = String(formData.get("content") ?? "").trim().slice(0, 1200);
  if (title.length < 3 || content.length < 3) feedback(conversationId, "error", "Add both a title and evidence before creating the insight.");
  const insightId = randomUUID();
  try {
    if (!supabase) {
      const now = new Date().toISOString();
      mutateDatabase((database) => {
        const conversation = database.conversations.find((item) => item.id === conversationId && item.merchantId === identity.merchantId);
        if (!conversation) throw new Error("Conversation was not found for this merchant.");
        database.insights.unshift({ id: insightId, merchantId: identity.merchantId, productId: conversation.productId, productSlug: conversation.productSlug, type: "answer_quality", category: "merchant_review", title, detail: content, count: 1, severity: "medium", status: "open", createdAt: now, updatedAt: now });
        database.insightSources.unshift({ id: randomUUID(), insightId, conversationId, messageId: "merchant-review", createdAt: now });
      });
    } else {
      const { data: conversation, error: conversationError } = await supabase.from("conversations").select("product_id").eq("id", conversationId).eq("merchant_id", identity.merchantId).maybeSingle();
      if (conversationError || !conversation) throw conversationError ?? new Error("Conversation was not found.");
      const { error: insightError } = await supabase.from("insights").insert({ id: insightId, merchant_id: identity.merchantId, product_id: conversation.product_id, insight_type: "answer_quality", title, content, severity: "medium", frequency: 1, status: "open", metadata_json: { category: "merchant_review", conversation_id: conversationId } });
      if (insightError) throw insightError;
      const { error: sourceError } = await supabase.from("insight_sources").insert({ merchant_id: identity.merchantId, insight_id: insightId, conversation_id: conversationId });
      if (sourceError) throw sourceError;
    }
    await writeAuditLog({ merchantId: identity.merchantId, actorUserId: identity.userId, action: "insight_created", entityType: "insight", entityId: insightId, details: { conversation_id: conversationId } });
  } catch (error) {
    logFailure("create_conversation_insight", error);
    feedback(conversationId, "error", "The insight could not be created. The conversation is unchanged.");
  }
  revalidatePath(`/dashboard/conversations/${conversationId}`);
  revalidatePath("/dashboard/insights");
  feedback(conversationId, "notice", "Insight created and added to the Insights page.");
}
