import type { PromptVersionRow } from "@/lib/supabase/types";

export function nextPromptVersionNumber(
  versions: Array<Pick<PromptVersionRow, "version_number">>,
): number {
  return (
    versions.reduce(
      (highest, version) => Math.max(highest, version.version_number),
      0,
    ) + 1
  );
}

export function getCurrentPromptCandidate<
  T extends Pick<PromptVersionRow, "status" | "version_number">,
>(versions: T[]): T | null {
  return versions.reduce<T | null>((current, version) => {
    if (version.status !== "draft" && version.status !== "tested")
      return current;
    if (!current || version.version_number > current.version_number)
      return version;
    return current;
  }, null);
}

export function comparePromptText(active: string, candidate: string) {
  const activeLines = active.split(/\r?\n/);
  const candidateLines = candidate.split(/\r?\n/);
  return {
    changed: active !== candidate,
    activeCharacters: active.length,
    candidateCharacters: candidate.length,
    addedLines: candidateLines.filter((line) => !activeLines.includes(line)),
    removedLines: activeLines.filter((line) => !candidateLines.includes(line)),
  };
}
