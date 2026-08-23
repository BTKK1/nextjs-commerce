"use client";

import { useEffect } from "react";
import { useStoreLocale } from "@/components/saleh-demo/StoreLocaleProvider";

function getVisitorRef() {
  const key = "saleh-demo-visitor";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = `anon-${crypto.randomUUID().slice(0, 8)}`;
  window.localStorage.setItem(key, created);
  return created;
}

export function ProductTelemetry({ productSlug, merchantKey }: { productSlug: string; merchantKey: string }) {
  const { locale } = useStoreLocale();

  useEffect(() => {
    const visitorRef = getVisitorRef();
    void fetch("/api/events", {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "product_page_view", merchantKey, productSlug, visitorRef, locale })
    }).catch(() => undefined);
  }, [locale, merchantKey, productSlug]);

  return null;
}
