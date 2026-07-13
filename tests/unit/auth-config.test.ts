import { describe, expect, it, vi } from "vitest";

async function importAuthOptionsWithSecret(secret: string | undefined) {
  const previousSecret = process.env.NEXTAUTH_SECRET;
  if (secret === undefined) {
    delete process.env.NEXTAUTH_SECRET;
  } else {
    process.env.NEXTAUTH_SECRET = secret;
  }

  vi.resetModules();
  vi.doMock("@/utils/bagisto", () => ({ bagistoFetch: vi.fn() }));
  vi.doMock("@/graphql/customer/mutations", () => ({ CUSTOMER_LOGIN: "CUSTOMER_LOGIN" }));

  const { authOptions } = await import("@/utils/auth");

  if (previousSecret === undefined) {
    delete process.env.NEXTAUTH_SECRET;
  } else {
    process.env.NEXTAUTH_SECRET = previousSecret;
  }
  vi.doUnmock("@/utils/bagisto");
  vi.doUnmock("@/graphql/customer/mutations");
  vi.resetModules();

  return authOptions;
}

describe("NextAuth config", () => {
  it("does not use a hard-coded demo secret when NEXTAUTH_SECRET is missing", async () => {
    const authOptions = await importAuthOptionsWithSecret(undefined);

    expect(authOptions.secret).toBeUndefined();
  });

  it("uses the explicit server-side NEXTAUTH_SECRET when configured", async () => {
    const authOptions = await importAuthOptionsWithSecret("unit-test-nextauth-secret");

    expect(authOptions.secret).toBe("unit-test-nextauth-secret");
  });
});
