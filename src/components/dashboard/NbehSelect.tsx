"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useDashboardLocale } from "@/components/dashboard/DashboardLocale";

export interface NbehSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface NbehSelectProps {
  name?: string;
  options: readonly NbehSelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  required?: boolean;
}

export function NbehSelect({
  name,
  options,
  value,
  defaultValue = "",
  onValueChange,
  ariaLabel,
  className = "",
  buttonClassName = "",
  menuClassName = "",
  required = false,
}: NbehSelectProps) {
  const { t } = useDashboardLocale();
  const generatedId = useId();
  const listboxId = `nbeh-listbox-${generatedId.replaceAll(":", "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = value ?? internalValue;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === selectedValue));
  const [highlightedIndex, setHighlightedIndex] = useState(selectedIndex);
  const selected = useMemo(() => options.find((option) => option.value === selectedValue) ?? options[0], [options, selectedValue]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function choose(nextValue: string) {
    if (value === undefined) setInternalValue(nextValue);
    onValueChange?.(nextValue);
    if (hiddenInputRef.current) {
      hiddenInputRef.current.value = nextValue;
      hiddenInputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
      hiddenInputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setOpen(false);
  }

  function moveHighlight(direction: 1 | -1) {
    if (!options.length) return;
    let next = highlightedIndex;
    do next = (next + direction + options.length) % options.length;
    while (options[next]?.disabled && next !== highlightedIndex);
    setHighlightedIndex(next);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      else moveHighlight(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" && open) { event.preventDefault(); setHighlightedIndex(0); return; }
    if (event.key === "End" && open) { event.preventDefault(); setHighlightedIndex(options.length - 1); return; }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      const option = options[highlightedIndex];
      if (option && !option.disabled) choose(option.value);
      return;
    }
    if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`} data-nbeh-select>
      {name ? <input ref={hiddenInputRef} type="hidden" name={name} value={selectedValue} required={required} /> : null}
      <button
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listboxId}-${highlightedIndex}` : undefined}
        onClick={() => setOpen((current) => {
          if (!current) setHighlightedIndex(selectedIndex);
          return !current;
        })}
        onKeyDown={handleKeyDown}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-[14px] border bg-white px-4 py-2.5 text-left text-sm font-medium text-[#0B0E12] shadow-[0_8px_22px_-18px_rgba(11,14,18,.4)] transition ${open ? "border-[#5B2EFF] ring-4 ring-[#5B2EFF]/10" : "border-[#D6D9E1] hover:border-[#BFB3F4] hover:bg-[#FBFAFF]"} ${buttonClassName}`}
      >
        <span className="min-w-0 truncate" data-nbeh-select-label>{t(selected?.label ?? "Select an option")}</span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F1EDFF] text-[#5B2EFF]">
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </span>
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute z-[90] mt-2 max-h-72 w-full min-w-[220px] overflow-y-auto rounded-[16px] border border-[#DDD6F7] bg-white p-1.5 shadow-[0_22px_55px_-18px_rgba(35,20,90,.34)] ${menuClassName}`}
        >
          {options.map((option, index) => {
            const isSelected = option.value === selectedValue;
            const isHighlighted = index === highlightedIndex;
            return (
              <button
                key={option.value}
                id={`${listboxId}-${index}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                onClick={() => choose(option.value)}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[#F7F5FF] disabled:cursor-not-allowed disabled:opacity-40 ${isHighlighted ? "bg-[#F1EDFF]" : ""}`}
              >
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isSelected ? "bg-[#5B2EFF] text-white" : "border border-[#D8D2E7] text-transparent"}`}>
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm ${isSelected ? "font-bold text-[#4A21D6]" : "font-medium text-[#292530]"}`}>{t(option.label)}</span>
                  {option.description ? <span className="mt-0.5 block text-xs leading-5 text-[#797384]">{t(option.description)}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
