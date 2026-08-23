import { afterEach, describe, expect, it, vi } from "vitest";
import { providerLaunchCheck } from "@/lib/ops/beta-readiness";

function configureSallaEnvironment(): void {
  vi.stubEnv("SALLA_CLIENT_ID", "salla-client-id");
  vi.stubEnv("SALLA_CLIENT_SECRET", "salla-client-secret");
  vi.stubEnv("SALLA_WEBHOOK_SECRET", "salla-webhook-secret");
}

const connectedSalla = {
  id: "integration-salla-1",
  merchant_id: "merchant-salla-1",
  provider: "salla",
  status: "connected",
  external_store_id: "store-salla-1",
  encrypted_credential_ref: "encrypted-credential",
  last_synced_at: "2026-08-22T00:00:00.000Z",
};

afterEach(() => vi.unstubAllEnvs());

describe("beta readiness provider gates", () => {
  it("does not mistake production configuration for a connected Salla merchant", () => {
    configureSallaEnvironment();

    const check = providerLaunchCheck("salla", [], [], []);

    expect(check.passed).toBe(false);
    expect(check.detail).toContain("a connected merchant install");
  });

  it("requires the same connected install to have identity, encrypted credentials, sync, and products", () => {
    configureSallaEnvironment();

    const incomplete = providerLaunchCheck("salla", [{
      ...connectedSalla,
      encrypted_credential_ref: null,
      last_synced_at: null,
    }], [], []);

    expect(incomplete.passed).toBe(false);
    expect(incomplete.detail).toContain("encrypted store credential");
    expect(incomplete.detail).toContain("successful catalog sync");
    expect(incomplete.detail).toContain("at least one synchronized product");
  });

  it("passes only when one connected Salla install satisfies every launch requirement", () => {
    configureSallaEnvironment();

    const check = providerLaunchCheck(
      "salla",
      [connectedSalla],
      [{ merchant_id: connectedSalla.merchant_id, platform: "salla" }],
      [{ integration_id: connectedSalla.id, provider: "salla", status: "success" }],
    );

    expect(check).toMatchObject({ id: "salla", passed: true });
  });

  it("stays blocked when signed-webhook configuration is absent", () => {
    vi.stubEnv("SALLA_CLIENT_ID", "salla-client-id");
    vi.stubEnv("SALLA_CLIENT_SECRET", "salla-client-secret");
    vi.stubEnv("SALLA_WEBHOOK_SECRET", "");

    const check = providerLaunchCheck(
      "salla",
      [connectedSalla],
      [{ merchant_id: connectedSalla.merchant_id, platform: "salla" }],
      [{ integration_id: connectedSalla.id, provider: "salla", status: "success" }],
    );

    expect(check.passed).toBe(false);
    expect(check.detail).toContain("SALLA_WEBHOOK_SECRET");
  });
});
