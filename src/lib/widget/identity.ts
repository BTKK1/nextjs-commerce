/**
 * Public widget identities come from either Nbeh public keys or the commerce
 * platform's own store ID. Zid store IDs can be shorter than eight characters,
 * so validation must not assume Nbeh's generated-key length.
 */
export const WIDGET_MERCHANT_KEY_PATTERN = /^[a-zA-Z0-9_-]{1,96}$/;

export function isValidWidgetMerchantKey(value: string): boolean {
  return WIDGET_MERCHANT_KEY_PATTERN.test(value);
}
