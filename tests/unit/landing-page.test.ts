import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const expectedLandingSha256 = "EA9B6C98279F23A3EB4320811D0DF97125A3114B2A8E668985AFCF75DDFB8083";

describe("Nbeh landing page", () => {
  it("keeps the client-supplied HTML byte-for-byte intact", () => {
    const contents = readFileSync(join(root, "public", "nbeh-landing.html"));
    const digest = createHash("sha256").update(contents).digest("hex").toUpperCase();

    expect(digest).toBe(expectedLandingSha256);
  });

  it("serves the exact HTML at the application root", () => {
    const nextConfig = readFileSync(join(root, "next.config.ts"), "utf8");

    expect(nextConfig).toContain("beforeFiles:");
    expect(nextConfig).toContain('source: "/"');
    expect(nextConfig).toContain('destination: "/nbeh-landing.html"');
  });
});
