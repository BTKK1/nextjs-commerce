import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("prompt governance UI safety", () => {
  it("requires explicit confirmation before publish, rollback, and archive submits", () => {
    const component = readFileSync(
      join(process.cwd(), "src/components/dashboard/ConfirmSubmitButton.tsx"),
      "utf8",
    );
    const page = readFileSync(
      join(process.cwd(), "src/app/dashboard/agent/versions/page.tsx"),
      "utf8",
    );

    expect(component).toContain("window.confirm");
    expect(page).toContain("ConfirmSubmitButton");
    expect(page).toContain("immediately changes shopper responses");
    expect(page).toContain("recorded in the audit log");
  });

  it("requires explicit confirmation before a Founder changes all Nbeh agents", () => {
    const form = readFileSync(
      join(process.cwd(), "src/components/dashboard/GlobalAgentForm.tsx"),
      "utf8",
    );
    expect(form).toContain("This affects every merchant agent immediately");
    expect(form).toContain("ConfirmSubmitButton");
  });

  it("presents the playground as two agents with selectable product-page context", () => {
    const playground = readFileSync(
      join(process.cwd(), "src/components/dashboard/AgentPlayground.tsx"),
      "utf8",
    );
    const page = readFileSync(
      join(process.cwd(), "src/app/dashboard/agent/playground/page.tsx"),
      "utf8",
    );
    const shell = readFileSync(
      join(process.cwd(), "src/app/dashboard/layout.tsx"),
      "utf8",
    );

    expect(playground).toContain("Two agents. One shopper question.");
    expect(playground).toContain('title="Live Agent"');
    expect(playground).toContain('title="Draft Agent"');
    expect(playground).toContain("Choose the product page to test");
    expect(playground).toContain('ariaLabel="Product context"');
    expect(playground).toContain("onValueChange={changeProduct}");
    expect(playground).not.toContain("Shopper language");
    expect(playground).not.toContain("Nbeh detects the shopper");
    expect(playground).toContain("detectLanguage(message)");
    expect(page).toContain("Founder demo store");
    expect(shell).toContain('identity.role === "founder"');
    expect(shell).toContain("Demo store");
  });

  it("shows Nbeh only on a verified demo product page", () => {
    const home = readFileSync(
      join(process.cwd(), "src/components/saleh-demo/DemoHomePage.tsx"),
      "utf8",
    );
    const product = readFileSync(
      join(process.cwd(), "src/components/saleh-demo/DemoProductPage.tsx"),
      "utf8",
    );
    expect(home).not.toContain("<AgentWidget");
    expect(product).toContain("<AgentWidget");
    expect(product).toContain("productName={localizedProduct.name}");
  });

  it("gives store owners simple bilingual storefront widget controls", () => {
    const settings = readFileSync(
      join(process.cwd(), "src/app/dashboard/settings/page.tsx"),
      "utf8",
    );
    const actions = readFileSync(
      join(process.cwd(), "src/app/dashboard/settings/actions.ts"),
      "utf8",
    );

    for (const control of [
      "widget_position_ar",
      "widget_position_en",
      "widget_auto_popup_enabled",
      "widget_auto_popup_delay_seconds",
    ]) expect(settings).toContain(control);
    expect(settings).not.toContain("widget_onboarding_message_ar");
    expect(settings).not.toContain("widget_onboarding_message_en");
    expect(settings).toContain("Welcome message is automatic");
    expect(settings).toContain("toneLabel");
    expect(settings).toContain("dialectLabel");
    expect(settings).toContain("product page");
    expect(actions).toContain("widget_preferences_updated");
    expect(actions).toContain("Auto popup delay must be between 0 and 60 seconds");
  });

  it("keeps tone and dialect as the simple merchant-facing agent controls", () => {
    const advanced = readFileSync(
      join(process.cwd(), "src/app/dashboard/agent/advanced/page.tsx"),
      "utf8",
    );
    expect(advanced).toContain('name="tone_preset"');
    expect(advanced).toContain('name="arabic_tone"');
    expect(advanced).toContain("How should Nbeh sound?");
    expect(advanced).toContain("Arabic dialect");
  });

  it("derives playground language from the latest message on the server", () => {
    const route = readFileSync(
      join(process.cwd(), "src/app/api/dashboard/agent/playground/route.ts"),
      "utf8",
    );
    expect(route).toContain('locale: z.enum(["en", "ar"]).optional()');
    expect(
      route.match(/const locale = detectLanguage\(input\.message\)/g),
    ).toHaveLength(2);
  });

  it("keeps local demo governance actions off the Supabase-only write path", () => {
    const actions = readFileSync(
      join(process.cwd(), "src/app/dashboard/agent/actions.ts"),
      "utf8",
    );
    const repository = readFileSync(
      join(process.cwd(), "src/lib/agent/config-repository.ts"),
      "utf8",
    );
    const localStore = readFileSync(
      join(process.cwd(), "src/lib/agent/local-admin-store.ts"),
      "utf8",
    );
    expect(actions).toContain('resolveDataBackend() === "local"');
    expect(actions).toContain("mutateLocalAgentAdminState");
    expect(repository).toContain("readLocalAgentAdminState");
    expect(localStore).toContain("ifMatch: loaded.etag");
  });

  it("contains unexpected dashboard failures without implying data loss", () => {
    const boundary = readFileSync(
      join(process.cwd(), "src/app/dashboard/error.tsx"),
      "utf8",
    );
    expect(boundary).toContain(
      "Your live agent and saved data were not changed",
    );
    expect(boundary).toContain("error.digest");
    expect(boundary).toContain("Back to dashboard");
  });

  it("renders server component children without recursively mutating them on the client", () => {
    const locale = readFileSync(
      join(process.cwd(), "src/components/dashboard/DashboardLocale.tsx"),
      "utf8",
    );
    const provider = locale.slice(
      locale.indexOf("export function DashboardLocaleProvider"),
      locale.indexOf("export function useDashboardLocale"),
    );
    expect(provider).toContain("{children}");
    expect(provider).toContain("</DashboardLocaleContext.Provider>");
    expect(provider).not.toContain("translateNode(children");
    expect(locale).toContain("node.every(");
    expect(locale).toContain('typeof child === "number"');
  });

  it("makes a saved draft unmistakable and offers the safe next step", () => {
    const feedback = readFileSync(
      join(process.cwd(), "src/components/dashboard/ActionFeedback.tsx"),
      "utf8",
    );
    const advanced = readFileSync(
      join(process.cwd(), "src/app/dashboard/agent/advanced/page.tsx"),
      "utf8",
    );
    expect(advanced).toContain('successTitle="Draft saved"');
    expect(advanced).toContain('label: "Test and publish"');
    expect(advanced).toContain("DraftSubmitButton");
    expect(advanced).not.toContain(">Run QA</Link>");
    expect(feedback).toContain(
      "Your live agent and saved configuration were not changed",
    );
  });

  it("does not present saved Playground comparisons as QA scores", () => {
    const summary = readFileSync(
      join(process.cwd(), "src/app/dashboard/agent/page.tsx"),
      "utf8",
    );
    const qa = readFileSync(
      join(process.cwd(), "src/app/dashboard/agent/qa/page.tsx"),
      "utf8",
    );
    expect(summary).toContain('String(run.status) !== "playground_saved"');
    expect(qa).toContain("verificationRuns");
    expect(qa).toContain("playgroundComparisons");
    expect(qa).toContain("Saved Playground comparisons");
  });

  it("keeps publishing behind QA and collapses the exceptional override path", () => {
    const versions = readFileSync(
      join(process.cwd(), "src/app/dashboard/agent/versions/page.tsx"),
      "utf8",
    );
    const qa = readFileSync(
      join(process.cwd(), "src/app/dashboard/agent/qa/page.tsx"),
      "utf8",
    );
    expect(versions).toContain("Your current draft");
    expect(versions).toContain("Version history");
    expect(versions).not.toContain("archivePromptVersionAction");
    expect(qa).toContain("Publish to shoppers");
    expect(qa).toContain("getCurrentPromptCandidate");
    expect(versions).toContain("Emergency override");
    expect(versions).toContain("qaPassed ? (");
  });
});
