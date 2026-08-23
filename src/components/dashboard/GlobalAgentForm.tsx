"use client";

import { useMemo, useState } from "react";
import { Brain, Check, ChevronDown, MessageCircle, Save, ShieldCheck, Sparkles } from "lucide-react";
import { saveGlobalAgentAction } from "@/app/dashboard/platform/actions";
import type { GlobalAgentConfig } from "@/lib/agent/global-config";
import type { ProductAgentProvider } from "@/lib/ai/model-config";
import { SELECTABLE_MODELS } from "@/lib/ai/model-catalog";
import { NbehSelect } from "@/components/dashboard/NbehSelect";
import { ConfirmSubmitButton } from "@/components/dashboard/ConfirmSubmitButton";
import { DashboardTranslated, useDashboardLocale } from "@/components/dashboard/DashboardLocale";

const modelChoices = (Object.entries(SELECTABLE_MODELS) as Array<
  [ProductAgentProvider, (typeof SELECTABLE_MODELS)[ProductAgentProvider]]
>).flatMap(([provider, models]) =>
  models.map((model) => ({
    value: `${provider}::${model.id}`,
    label: model.label,
    description: model.description,
    provider,
    model: model.id,
  })),
);

export function GlobalAgentForm({ config }: { config: GlobalAgentConfig }) {
  const { locale, t } = useDashboardLocale();
  const initialChoice = `${config.modelProvider}::${config.modelName}`;
  const [modelChoice, setModelChoice] = useState(initialChoice);
  const selected = useMemo(
    () => modelChoices.find((choice) => choice.value === modelChoice),
    [modelChoice],
  );
  const provider = selected?.provider ?? config.modelProvider;
  const model = selected?.model ?? config.modelName;
  const options = modelChoices.some((choice) => choice.value === initialChoice)
    ? modelChoices
    : [
        {
          value: initialChoice,
          label: config.modelName,
          description: "Current model",
          provider: config.modelProvider,
          model: config.modelName,
        },
        ...modelChoices,
      ];

  return (
    <DashboardTranslated>
      <form action={saveGlobalAgentAction} className="mt-7 overflow-hidden rounded-[24px] border border-[#DED8F5] bg-white shadow-[0_22px_60px_-42px_rgba(54,31,144,.6)]">
        <div className="border-b border-[#E9E4F7] bg-[radial-gradient(620px_190px_at_100%_0%,rgba(91,46,255,.15),transparent_68%),#FBFAFF] p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#5B2EFF] text-white shadow-[0_10px_24px_rgba(91,46,255,.24)]"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
            <div>
              <h2 className="text-xl font-bold text-[#17131F]">Shape how Nbeh sells</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[#676171]">Choose the AI model and describe the behavior you want in everyday language. Nbeh keeps its product accuracy and safety rules automatically.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-5 sm:p-7">
          <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-[18px] border border-[#E5E0F3] bg-[#FCFBFF] p-5">
              <label className="text-sm font-bold text-[#292530]">
                <span className="flex items-center gap-2"><Brain className="h-4 w-4 text-[#5B2EFF]" /> AI model</span>
                <NbehSelect value={modelChoice} onValueChange={setModelChoice} ariaLabel="AI model" className="mt-2" buttonClassName="min-h-[58px] bg-white" menuClassName="max-h-96" options={options.map((choice) => ({ value: choice.value, label: choice.label, description: choice.description }))} />
              </label>
              <input type="hidden" name="model_provider" value={provider} />
              <input type="hidden" name="model_name" value={model} />
              <div className="mt-3 flex items-center gap-2 text-xs text-[#6C6289]"><Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />{selected?.description ?? "Current model"}</div>
            </div>

            <label className="block rounded-[18px] border border-[#E5E0F3] bg-white p-5 text-sm font-bold text-[#292530]">
              <span className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-[#5B2EFF]" /> What should Nbeh do differently?</span>
              <p className="mt-1 text-xs font-normal leading-5 text-[#777281]">Write this like you are briefing a sales employee. For example: “Keep answers short, explain honest trade-offs, and ask one useful question when needed.”</p>
              <textarea name="developer_prompt" maxLength={8000} defaultValue={config.developerPrompt} placeholder="Describe the selling style, priorities, or boundaries you want…" className="mt-3 min-h-40 w-full resize-y rounded-[15px] border border-[#D8D4E4] bg-[#FCFBFE] p-4 text-sm font-normal leading-6 text-[#17131F] outline-none transition focus:border-[#5B2EFF] focus:bg-white focus:ring-4 focus:ring-[#5B2EFF]/10" />
            </label>
          </section>

          <section className="rounded-[18px] border border-emerald-200 bg-emerald-50/70 p-5">
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" /><div><h3 className="font-bold text-emerald-950">Always protected</h3><p className="mt-1 text-sm leading-6 text-emerald-900">Nbeh only uses verified store and product information, protects private instructions, and never asks shoppers for payment details.</p></div></div>
          </section>

          <details className="group rounded-[18px] border border-[#E5E0F3] bg-[#FAF9FD] p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-[#292530]"><span>Advanced: edit Nbeh’s core rules</span><ChevronDown className="h-5 w-5 text-[#5B2EFF] transition group-open:rotate-180" aria-hidden="true" /></summary>
            <p className="mt-2 text-sm leading-6 text-[#777281]">Most founders never need this. Change it only when you need to rewrite Nbeh’s shared personality or safety instructions.</p>
            <label className="mt-4 block text-sm font-bold text-[#292530]">Core personality and safety rules<textarea name="system_prompt" required minLength={40} maxLength={16000} defaultValue={config.systemPrompt} className="mt-2 min-h-[28rem] w-full rounded-[15px] border border-[#D8D4E4] bg-white p-4 font-mono text-sm font-normal leading-6 outline-none focus:border-[#5B2EFF] focus:ring-4 focus:ring-[#5B2EFF]/10" /></label>
            <div className="mt-3 rounded-[13px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">These rules affect every Nbeh agent. Mandatory accuracy and safety protections still cannot be removed.</div>
          </details>

          <div className="flex flex-col gap-4 border-t border-[#E9E4F1] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-[#686271]">Last updated {config.updatedAt ? new Date(config.updatedAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", { timeZone: "Asia/Riyadh" }) : t("from the deployed Nbeh defaults")}</p>
            <ConfirmSubmitButton confirmation="Save these global changes? This affects every merchant agent immediately." pendingLabel="Saving global agent…" className="group rounded-[14px] bg-[#5B2EFF] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(91,46,255,.22)] transition hover:-translate-y-0.5 hover:bg-[#4A21D6]"><Save className="h-4 w-4" aria-hidden="true" /> {t("Save global agent")}</ConfirmSubmitButton>
          </div>
        </div>
      </form>
    </DashboardTranslated>
  );
}
