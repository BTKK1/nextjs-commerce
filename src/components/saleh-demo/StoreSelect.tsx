"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export function StoreSelect({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: readonly string[];
}) {
  const id = useId().replaceAll(":", "");
  const listboxId = `store-select-${id}`;
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue);
  const [highlighted, setHighlighted] = useState(Math.max(0, options.indexOf(defaultValue)));

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function choose(next: string) {
    setValue(next);
    setHighlighted(options.indexOf(next));
    setOpen(false);
  }

  function move(direction: 1 | -1) {
    setHighlighted((current) => (current + direction + options.length) % options.length);
  }

  return (
    <div ref={root} className="relative" data-store-select>
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">{label}</span>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listboxId}-${highlighted}` : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) setOpen(true);
            else move(event.key === "ArrowDown" ? 1 : -1);
          } else if ((event.key === "Enter" || event.key === " ") && open) {
            event.preventDefault();
            choose(options[highlighted]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
        className="mt-2 flex min-h-12 w-full items-center justify-between gap-3 border-b border-stone-300 bg-transparent py-3 text-left text-sm text-ink outline-none transition hover:border-[#7d623f] focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-[#7d623f]/20"
      >
        <span>{value}</span>
        <ChevronDown className={`h-4 w-4 text-[#7d623f] transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open ? (
        <div id={listboxId} role="listbox" aria-label={label} className="absolute z-50 mt-2 max-h-64 w-full overflow-y-auto rounded-lg border border-stone-200 bg-[#fffdf8] p-1.5 shadow-[0_20px_50px_-20px_rgba(42,34,25,.45)]">
          {options.map((option, index) => (
            <button
              key={option}
              id={`${listboxId}-${index}`}
              type="button"
              role="option"
              aria-selected={option === value}
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => choose(option)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition ${index === highlighted ? "bg-[#eee7da]" : "hover:bg-[#f5f0e8]"}`}
            >
              <span className={option === value ? "font-semibold text-ink" : "text-stone-700"}>{option}</span>
              {option === value ? <Check className="h-4 w-4 text-[#7d623f]" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
