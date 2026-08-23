import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("dashboard mutation feedback", () => {
  it("gives every dashboard submit control a pending state", () => {
    const actionButton = source("src/components/dashboard/DashboardActionButton.tsx");
    const confirmButton = source("src/components/dashboard/ConfirmSubmitButton.tsx");
    const settingsButton = source("src/components/dashboard/SettingsSubmitButton.tsx");
    const draftButton = source("src/components/dashboard/DraftSubmitButton.tsx");

    for (const component of [actionButton, confirmButton, settingsButton, draftButton]) {
      expect(component).toContain("useFormStatus");
      expect(component).toContain("pending");
      expect(component).toContain("disabled");
    }
  });

  it("renders visible action feedback on every mutating dashboard feature", () => {
    const pages = [
      "src/app/dashboard/settings/page.tsx",
      "src/app/dashboard/platform/page.tsx",
      "src/app/dashboard/integrations/page.tsx",
      "src/app/dashboard/insights/page.tsx",
      "src/app/dashboard/conversations/[id]/page.tsx",
      "src/app/dashboard/agent/advanced/page.tsx",
      "src/app/dashboard/agent/qa/page.tsx",
      "src/app/dashboard/agent/versions/page.tsx",
    ];

    for (const page of pages) expect(source(page)).toContain("ActionFeedback");
  });

  it("keeps the Founder editor understandable without removing advanced control", () => {
    const globalForm = source("src/components/dashboard/GlobalAgentForm.tsx");
    const merchantEditor = source("src/app/dashboard/agent/advanced/page.tsx");

    expect(globalForm).toContain("What should Nbeh do differently?");
    expect(globalForm).toContain("AI model");
    expect(globalForm).toContain("Advanced: edit Nbeh’s core rules");
    expect(globalForm).toContain('name="system_prompt"');
    expect(merchantEditor).toContain("Write this like you are briefing a sales employee");
    expect(merchantEditor).toContain("Advanced behavior and safety controls");
  });

  it("saves one inherited draft atomically instead of clearing advanced fields", () => {
    const actions = source("src/app/dashboard/agent/actions.ts");
    const migration = source("supabase/migrations/202608230012_atomic_prompt_draft_save.sql");

    expect(actions).toContain('rpc(\n      "save_prompt_draft_atomic"');
    expect(actions).toContain("readVersionedAgentSettings(currentCandidate.test_result)");
    expect(actions).toContain('submittedListOr(formData, "allowed_topics"');
    expect(actions).toContain('submittedListOr(formData, "blocked_topics"');
    expect(actions).toContain('submittedListOr(formData, "blocked_claims"');
    expect(actions).toContain('"tone_examples",\n          record(baseConfig.advanced_settings).tone_examples');
    expect(migration).toContain("for update");
    expect(migration).toContain("status in ('draft', 'tested')");
    expect(migration).toContain("'prompt_draft_saved'");
  });
});
