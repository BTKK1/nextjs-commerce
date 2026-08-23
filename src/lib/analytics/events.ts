import { randomUUID } from "node:crypto";
import { mutateDatabase } from "@/lib/storage/json-store";
import type { AnalyticsEvent, AnalyticsEventType, DemoDatabase, DemoProduct, StorefrontLocale } from "@/lib/types";

interface TrackEventInput {
  type: AnalyticsEventType;
  product: DemoProduct;
  visitorRef: string;
  storefrontLocale?: StorefrontLocale;
  merchantId?: string;
}

export function appendAnalyticsEvent(db: DemoDatabase, input: TrackEventInput): AnalyticsEvent {
  const event = createAnalyticsEvent(input, db.merchants[0].id);
  db.events.push(event);
  return event;
}

export function createAnalyticsEvent(input: TrackEventInput, fallbackMerchantId?: string): AnalyticsEvent {
  return {
    id: randomUUID(),
    merchantId: input.merchantId ?? input.product.merchantId ?? fallbackMerchantId ?? "",
    productId: input.product.id,
    productSlug: input.product.slug,
    visitorRef: input.visitorRef,
    type: input.type,
    storefrontLocale: input.storefrontLocale ?? null,
    createdAt: new Date().toISOString()
  };
}

export function trackAnalyticsEvent(input: TrackEventInput): AnalyticsEvent {
  return mutateDatabase((db) => appendAnalyticsEvent(db, input));
}
