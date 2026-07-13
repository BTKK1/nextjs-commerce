import { expect, type Page } from "@playwright/test";

const ignoredConsoleFragments = [
  "Download the React DevTools",
  "favicon",
];

export function watchPageForFailures(page: Page) {
  const failures: string[] = [];

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (ignoredConsoleFragments.some((fragment) => text.includes(fragment))) return;
    failures.push(`console error: ${text}`);
  });

  page.on("pageerror", (error) => {
    failures.push(`page error: ${error.message}`);
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    const errorText = request.failure()?.errorText ?? "";
    if (url.includes("/_next/webpack-hmr")) return;
    if (
      errorText === "net::ERR_ABORTED" &&
      (url.includes("_rsc=") ||
        url.includes("/api/events") ||
        url.includes("/_next/image") ||
        url.includes("/_next/static/chunks/"))
    ) {
      return;
    }
    failures.push(`request failed: ${request.method()} ${url} ${errorText}`);
  });

  return {
    failures,
    async expectClean() {
      expect(failures).toEqual([]);
    },
  };
}
