import { afterEach, describe, expect, it, vi } from "vitest";
import { getDashboardIdentity } from "@/lib/auth/require-user";

afterEach(() => vi.unstubAllEnvs());

describe("local dashboard identity", () => {
  it("does not grant the demo owner identity when demo mode is disabled", async () => {
    vi.stubEnv("DATA_BACKEND", "local");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");

    await expect(getDashboardIdentity()).resolves.toBeNull();
  });

  it("grants the demo owner identity only when demo mode is explicitly enabled", async () => {
    vi.stubEnv("DATA_BACKEND", "local");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");

    await expect(getDashboardIdentity()).resolves.toMatchObject({
      role: "owner",
      authMode: "local_demo",
      userId: null,
    });
  });
});
