"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Sparkles } from "lucide-react";

type Side = "left" | "right";
type PreviewLanguage = "ar" | "en";

type PreviewSettings = {
  positionAr: Side;
  positionEn: Side;
  teaserMessageAr: string;
  teaserMessageEn: string;
  autoPopupEnabled: boolean;
  autoPopupDelaySeconds: number;
};

function NbehFace() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className="h-full w-full">
      <path d="M 42 10 H 78 A 32 32 0 0 1 110 42 V 78 A 32 32 0 0 1 78 110 H 18 A 8 8 0 0 1 10 102 V 42 A 32 32 0 0 1 42 10 Z" fill="#5B2EFF" />
      <circle cx="42" cy="52" r="9" fill="white" />
      <circle cx="78" cy="52" r="9" fill="white" />
      <path d="M42 76 Q60 90 78 76" fill="none" stroke="white" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

function formValue(form: HTMLFormElement, name: string): string {
  const field = form.elements.namedItem(name);
  return field instanceof HTMLInputElement || field instanceof HTMLSelectElement ? field.value : "";
}

export function WidgetSettingsPreview({ formId, dashboardLocale, initialSettings }: { formId: string; dashboardLocale: PreviewLanguage; initialSettings: PreviewSettings }) {
  const [language, setLanguage] = useState<PreviewLanguage>(dashboardLocale);
  const [settings, setSettings] = useState(initialSettings);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const sync = () => {
      setSettings({
        positionAr: formValue(form, "widget_position_ar") === "left" ? "left" : "right",
        positionEn: formValue(form, "widget_position_en") === "left" ? "left" : "right",
        teaserMessageAr: formValue(form, "widget_teaser_message_ar").slice(0, 120),
        teaserMessageEn: formValue(form, "widget_teaser_message_en").slice(0, 120),
        autoPopupEnabled: formValue(form, "widget_auto_popup_enabled") === "enabled",
        autoPopupDelaySeconds: Math.max(0, Math.min(60, Number(formValue(form, "widget_auto_popup_delay_seconds")) || 0)),
      });
    };
    form.addEventListener("input", sync);
    form.addEventListener("change", sync);
    sync();
    return () => {
      form.removeEventListener("input", sync);
      form.removeEventListener("change", sync);
    };
  }, [formId]);

  const side = language === "ar" ? settings.positionAr : settings.positionEn;
  const teaser = language === "ar" ? settings.teaserMessageAr : settings.teaserMessageEn;
  const isArabic = language === "ar";

  return (
    <section className="overflow-hidden rounded-[22px] border border-[#DCD5F8] bg-[#F8F6FF] shadow-[0_22px_60px_-42px_rgba(91,46,255,.65)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5DFF8] bg-white/90 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#EDE8FF] text-[#5B2EFF]"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>
          <div>
            <p className="text-sm font-bold text-[#241B38]">{isArabic ? "معاينة مباشرة في المتجر" : "Live storefront preview"}</p>
            <p className="text-xs text-[#746C82]">{isArabic ? "تتحدث فورًا أثناء تعديل الإعدادات" : "Updates instantly while you edit"}</p>
          </div>
        </div>
        <div className="flex rounded-[12px] border border-[#DCD5F8] bg-[#F8F6FF] p-1" aria-label={isArabic ? "لغة المعاينة" : "Preview language"}>
          {(["ar", "en"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setLanguage(item)} className={`rounded-[9px] px-3 py-1.5 text-xs font-bold transition ${language === item ? "bg-[#5B2EFF] text-white shadow-sm" : "text-[#655B75] hover:bg-white"}`}>
              {item === "ar" ? "العربية" : "English"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-[320px] overflow-hidden bg-[radial-gradient(520px_240px_at_80%_10%,rgba(91,46,255,.13),transparent_62%),linear-gradient(135deg,#FCFBFF,#F2EEFF)] p-5 sm:min-h-[350px] sm:p-7" dir={isArabic ? "rtl" : "ltr"}>
        <div className="mx-auto max-w-[560px] rounded-[22px] border border-white/80 bg-white/75 p-4 shadow-[0_24px_65px_-45px_rgba(34,23,69,.6)] backdrop-blur sm:p-5">
          <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
            <div className="aspect-square rounded-[18px] bg-[linear-gradient(145deg,#E8E2FF,#CFC4FF)] p-5">
              <div className="h-full rounded-[14px] border border-white/70 bg-white/45 shadow-inner" />
            </div>
            <div className="space-y-3 py-2">
              <div className="h-3 w-20 rounded-full bg-[#D8D1EB]" />
              <div className="h-5 w-4/5 rounded-full bg-[#2D2539]" />
              <div className="h-3 w-full rounded-full bg-[#E5E1ED]" />
              <div className="h-3 w-3/4 rounded-full bg-[#E5E1ED]" />
              <div className="h-10 w-36 rounded-[12px] bg-[#5B2EFF]" />
            </div>
          </div>
        </div>

        <div className={`absolute bottom-5 flex max-w-[calc(100%-40px)] items-end gap-2 ${side === "left" ? "left-5 flex-row" : "right-5 flex-row-reverse"}`}>
          <div className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-[20px] border border-white bg-white p-1.5 shadow-[0_18px_40px_-16px_rgba(91,46,255,.8)]">
            <NbehFace />
          </div>
          {teaser ? (
            <div className="mb-2 max-w-[250px] rounded-[16px] border border-[#DCD5F8] bg-white px-4 py-3 text-sm font-semibold leading-5 text-[#302645] shadow-[0_18px_45px_-28px_rgba(37,25,70,.65)]">
              {teaser}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#E5DFF8] bg-white/80 px-4 py-3 text-xs text-[#655B75] sm:px-5">
        <span className="inline-flex items-center gap-1.5"><MessageSquareText className="h-3.5 w-3.5 text-[#5B2EFF]" aria-hidden="true" />{settings.autoPopupEnabled ? (isArabic ? `يفتح تلقائيًا بعد ${settings.autoPopupDelaySeconds} ث` : `Auto-opens after ${settings.autoPopupDelaySeconds}s`) : (isArabic ? "الفتح التلقائي معطل" : "Auto-popup disabled")}</span>
        <span>{isArabic ? `الموضع: ${side === "left" ? "يسار" : "يمين"}` : `Position: ${side}`}</span>
      </div>
    </section>
  );
}
