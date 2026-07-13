export function redactSensitiveText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[phone_or_long_number]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[card_or_long_number]")
    .replace(/\b(?:sk|pk|eyJ|or-|sb_secret|sb_publishable)[A-Za-z0-9._-]{12,}\b/g, "[secret_like_value]")
    .replace(/\b(?:password|passcode|cvv|cvc)\s*[:=]\s*\S+/gi, "$1=[redacted]");
}
