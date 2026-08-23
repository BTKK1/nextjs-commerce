export type PromptRequirementKey =
  | "grounding"
  | "discounts"
  | "delivery"
  | "warranties"
  | "certifications"
  | "prompt_secrecy"
  | "payment_data"
  | "missing_info"
  | "shopper_language"
  | "arabic_tone"
  | "objections"
  | "next_question"
  | "product_page";

export interface PromptValidationFinding {
  key: PromptRequirementKey | "length";
  label: string;
  severity: "warning" | "error";
}

export interface PromptValidationResult {
  valid: boolean;
  hardFailures: number;
  findings: PromptValidationFinding[];
}

const requirements: Array<{ key: PromptRequirementKey; label: string; patterns: RegExp[]; hard?: boolean }> = [
  { key: "grounding", label: "Answer only from product or catalog context", patterns: [/answer only/i, /product|catalog|merchant context/i], hard: true },
  { key: "discounts", label: "Do not invent discounts", patterns: [/do not invent|never invent/i, /discount/i], hard: true },
  { key: "delivery", label: "Do not invent delivery dates", patterns: [/do not invent|never invent/i, /delivery date/i], hard: true },
  { key: "warranties", label: "Do not invent warranties", patterns: [/do not invent|never invent/i, /warrant/i], hard: true },
  { key: "certifications", label: "Do not invent certifications", patterns: [/do not invent|never invent/i, /certification/i], hard: true },
  { key: "prompt_secrecy", label: "Do not reveal the system prompt", patterns: [/do not reveal|never reveal/i, /system (instructions|prompt)/i], hard: true },
  { key: "payment_data", label: "Do not request card data", patterns: [/do not (collect|request)|never (collect|request)/i, /card|payment data/i], hard: true },
  { key: "missing_info", label: "Fallback when information is missing", patterns: [/information is missing|information is not available|missing information|do not have that detail/i], hard: true },
  { key: "shopper_language", label: "Answer in the shopper language", patterns: [/match the shopper'?s language|shopper language/i] },
  { key: "arabic_tone", label: "Use natural white Saudi Arabic", patterns: [/(?:white|neutral) Saudi/i, /Arabic/i] },
  { key: "objections", label: "Handle objections", patterns: [/objection/i] },
  { key: "next_question", label: "Ask a useful next question", patterns: [/next question|clarifying question/i] },
  { key: "product_page", label: "Keep the buyer on the product page", patterns: [/product page/i] },
];

export function validateSystemPrompt(prompt: string): PromptValidationResult {
  const findings: PromptValidationFinding[] = [];
  const normalized = prompt.trim();

  if (normalized.length < 240 || normalized.length > 16_000) {
    findings.push({ key: "length", label: "System prompt must be between 240 and 16,000 characters", severity: "error" });
  }

  for (const requirement of requirements) {
    if (!requirement.patterns.every((pattern) => pattern.test(normalized))) {
      findings.push({ key: requirement.key, label: requirement.label, severity: requirement.hard ? "error" : "warning" });
    }
  }

  const hardFailures = findings.filter((finding) => finding.severity === "error").length;
  return { valid: hardFailures === 0, hardFailures, findings };
}
