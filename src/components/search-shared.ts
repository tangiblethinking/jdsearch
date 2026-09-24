import { parseCompanies, type Company, type Job, type SortKey, type Source } from "@/lib/jobs";

export const STORE_KEY = "boardline-boards-v1";
export const CHUNK = 6;
export const RESULT_CAP = 400;
export const PAGE_SIZE = 25;
export const SUGGESTIONS = [
  "Director of Product Design",
  "Product Designer",
  "Staff Product Designer",
  "Design Manager",
];

export type Board = Company & { builtin: boolean };
export type Phase = "idle" | "loading" | "done" | "error";

export const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "company", label: "Company" },
  { key: "title", label: "Title" },
  { key: "workMode", label: "Type" },
  { key: "location", label: "Location" },
  { key: "country", label: "Country" },
  { key: "updated", label: "Updated" },
];

export function loadStore(): { added: Company[]; disabled: string[] } {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { added: [], disabled: [] };
    const parsed = JSON.parse(raw) as { added?: unknown; disabled?: unknown };
    const disabled = Array.isArray(parsed.disabled)
      ? parsed.disabled.filter((item): item is string => typeof item === "string").slice(0, 200)
      : [];
    return { added: parseCompanies(parsed.added), disabled };
  } catch {
    return { added: [], disabled: [] };
  }
}

export function readableError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  const clean = raw.replace(/^Error:\s*/, "").trim();
  if (clean && clean.length < 140 && !/server function|unexpected|fetch failed/i.test(clean)) return clean;
  return "The search stopped early. Anything already found is still listed.";
}

export function formatUpdated(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}

export function groupJobs(jobs: Job[]): { source: Source; jobs: Job[] }[] {
  const groups: { source: Source; jobs: Job[] }[] = [];
  for (const job of jobs) {
    const last = groups.at(-1);
    if (!last || last.source !== job.source) groups.push({ source: job.source, jobs: [job] });
    else last.jobs.push(job);
  }
  return groups;
}
