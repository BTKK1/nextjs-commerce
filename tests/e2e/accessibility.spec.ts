import { expect, test } from "@playwright/test";
import axe from "axe-core";

const routes = [
  "/login",
  "/dashboard",
  "/dashboard/conversations",
  "/dashboard/insights",
  "/dashboard/products",
  "/dashboard/agent",
  "/dashboard/agent/advanced",
  "/dashboard/agent/playground",
  "/dashboard/agent/qa",
  "/dashboard/agent/versions",
  "/dashboard/integrations",
  "/dashboard/settings",
  "/dashboard/audit-log",
  "/store/product/everyday-leather-tote",
  "/ar/store/product/everyday-leather-tote",
];

test("core Nbeh surfaces have no automatically detectable WCAG A/AA violations", async ({ page }) => {
  test.setTimeout(180_000);
  const findings: string[] = [];

  for (const route of routes) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    await page.addScriptTag({ content: axe.source });
    const result = await page.evaluate(async () => {
      const runner = (window as typeof window & { axe: typeof axe }).axe;
      return runner.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
        },
      });
    });

    for (const violation of result.violations) {
      const nodes = violation.nodes
        .slice(0, 4)
        .map((node) => `${node.target.join(" ")} — ${node.failureSummary ?? violation.help}`)
        .join(" | ");
      findings.push(`${route}: ${violation.id} (${violation.impact ?? "unknown"}) — ${nodes}`);
    }
  }

  expect(findings, findings.join("\n")).toEqual([]);
});
