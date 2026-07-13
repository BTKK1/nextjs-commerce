import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("merchant dashboard route surface", () => {
  it("ships the dashboard integrations provider-status page for the showcase build", () => {
    const integrationsPage = join(process.cwd(), "src", "app", "dashboard", "integrations", "page.tsx");

    expect(existsSync(integrationsPage)).toBe(true);
  });
});
