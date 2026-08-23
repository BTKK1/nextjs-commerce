import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "nbeh_founder_session";
const SESSION_SECONDS = 60 * 60 * 12;

interface FounderSessionPayload {
  email: string;
  role: "founder";
  exp: number;
}

function secret(): string | null {
  return process.env.FOUNDER_SESSION_SECRET || process.env.NEXTAUTH_SECRET || null;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(encodedPayload: string, key: string): string {
  return createHmac("sha256", key).update(encodedPayload).digest("base64url");
}

function equal(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function founderEmail(): string {
  return (process.env.FOUNDER_EMAIL || "Founder@nbeh.io").trim().toLowerCase();
}

export function isFounderAuthConfigured(): boolean {
  return Boolean(secret() && process.env.FOUNDER_PASSWORD_HASH && process.env.FOUNDER_PASSWORD_SALT);
}

export async function verifyFounderCredentials(email: string, password: string): Promise<boolean> {
  const expectedHash = process.env.FOUNDER_PASSWORD_HASH;
  const salt = process.env.FOUNDER_PASSWORD_SALT;
  if (!expectedHash || !salt || email.trim().toLowerCase() !== founderEmail()) return false;
  const { scrypt } = await import("node:crypto");
  const derived = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, (error, value) => error ? reject(error) : resolve(value as Buffer));
  });
  return equal(derived.toString("hex"), expectedHash);
}

export async function createFounderSession(): Promise<void> {
  const key = secret();
  if (!key) throw new Error("Founder session secret is not configured.");
  const payload: FounderSessionPayload = { email: founderEmail(), role: "founder", exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS };
  const encoded = encode(JSON.stringify(payload));
  const store = await cookies();
  store.set(COOKIE_NAME, `${encoded}.${sign(encoded, key)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearFounderSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getFounderSession(): Promise<FounderSessionPayload | null> {
  const key = secret();
  if (!key) return null;
  let token: string | undefined;
  try {
    token = (await cookies()).get(COOKIE_NAME)?.value;
  } catch {
    return null;
  }
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || !equal(sign(encoded, key), signature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as FounderSessionPayload;
    if (payload.role !== "founder" || payload.email !== founderEmail() || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
