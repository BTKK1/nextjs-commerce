import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const loader = String.raw`(() => {
  const script = document.currentScript;
  if (!script) return;
  const merchantKey = script.dataset.merchantKey;
  const productRef = script.dataset.productRef || document.querySelector('[data-product-id]')?.getAttribute('data-product-id');
  if (!merchantKey || !productRef) {
    console.error('[Nbeh] data-merchant-key and data-product-ref are required.');
    return;
  }
  const locale = script.dataset.locale === 'ar' ? 'ar' : 'en';
  const origin = new URL(script.src).origin;
  const iframe = document.createElement('iframe');
  iframe.title = 'Nbeh in-store sales assistant';
  iframe.src = origin + '/embed/widget?merchantKey=' + encodeURIComponent(merchantKey) + '&productRef=' + encodeURIComponent(productRef) + '&locale=' + locale + '&parentOrigin=' + encodeURIComponent(location.origin);
  iframe.loading = 'lazy';
  iframe.allow = 'clipboard-write';
  iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-downloads');
  Object.assign(iframe.style, { position: 'fixed', zIndex: '2147483000', border: '0', background: 'transparent', width: 'min(430px, 100vw)', height: 'min(760px, 100dvh)', right: '0', bottom: '0' });
  document.body.appendChild(iframe);
})();`;

export function GET() {
  return new NextResponse(loader, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
