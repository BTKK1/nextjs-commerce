import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export interface SallaCredentials {
  accessToken: string;
  refreshToken: string | null;
  issuedAt?: number;
  expiresAt: number | null;
  scope: string;
  tokenType: string;
}

function credentialKey(): Buffer {
  const secret = process.env.INTEGRATION_STATE_SECRET || process.env.GLOBAL_AGENT_CONFIG_SECRET;
  if (!secret) throw new Error("Integration credential encryption is not configured.");
  return createHash("sha256").update(`nbeh:salla:${secret}`).digest();
}

function decodeCanonicalBase64Url(value: string, label: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error(`The Salla credential ${label} is invalid.`);
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) throw new Error(`The Salla credential ${label} is invalid.`);
  return decoded;
}

export function sealSallaCredentials(credentials: SallaCredentials): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", credentialKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  return `salla:v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function openSallaCredentials(reference: string | null | undefined): SallaCredentials {
  const parts = String(reference ?? "").split(":");
  const [provider, version, ivValue, tagValue, encryptedValue] = parts;
  if (parts.length !== 5 || provider !== "salla" || version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("The Salla credential reference is invalid.");
  }
  const iv = decodeCanonicalBase64Url(ivValue, "IV");
  const tag = decodeCanonicalBase64Url(tagValue, "authentication tag");
  const encrypted = decodeCanonicalBase64Url(encryptedValue, "ciphertext");
  if (iv.length !== 12 || tag.length !== 16 || encrypted.length === 0) throw new Error("The Salla credential reference is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", credentialKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as SallaCredentials;
}
