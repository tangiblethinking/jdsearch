import { MODE_RANK } from "./job-filters";
import type { WorkMode } from "./job-filters";

export type { WorkMode, JobFilters } from "./job-filters";
export {
  WORK_MODES,
  WORK_MODE_LABEL,
  classifyLocation,
  emptyFilters,
  filterJobs,
  filtersAreActive,
  toggleFilterValue,
  uniqueCountries,
  uniqueSources,
  uniqueWorkModes,
} from "./job-filters";
export { normalize, normalizeRss } from "./jobs-normalize";
export { significantWords, matchesTitle } from "./jobs-query";

export const SOURCES = [
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "smartrecruiters",
  "recruitee",
  "breezy",
  "teamtailor",
] as const;

export type Source = (typeof SOURCES)[number];

export type Company = {
  name: string;
  source: Source;
  slug: string;
};

export type Job = {
  source: Source;
  company: string;
  title: string;
  location: string;
  country: string;
  workMode: WorkMode;
  url: string;
  updated: string;
};

export type BoardFailure = {
  name: string;
  source: Source;
  slug: string;
};

export type SearchPayload = {
  jobs: Job[];
  checked: number;
  failed: BoardFailure[];
};

export const SOURCE_META: { id: Source; label: string; hint: string }[] = [
  { id: "greenhouse", label: "Greenhouse", hint: "boards.greenhouse.io/{slug}" },
  { id: "lever", label: "Lever", hint: "jobs.lever.co/{slug}" },
  { id: "ashby", label: "Ashby", hint: "jobs.ashbyhq.com/{slug}" },
  { id: "workable", label: "Workable", hint: "apply.workable.com/{slug}" },
  { id: "smartrecruiters", label: "SmartRecruiters", hint: "jobs.smartrecruiters.com/{slug}" },
  { id: "recruitee", label: "Recruitee", hint: "{slug}.recruitee.com" },
  { id: "breezy", label: "Breezy", hint: "{slug}.breezy.hr" },
  { id: "teamtailor", label: "Teamtailor", hint: "{slug}.teamtailor.com" },
];

const SOURCE_RANK = new Map(SOURCES.map((source, index) => [source, index]));
const HOST_SOURCES = new Set<Source>(["recruitee", "breezy", "teamtailor"]);
const PATH_SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;
const HOST_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type SortKey = "source" | "company" | "title" | "location" | "country" | "workMode" | "updated";

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export function sortJobs(jobs: Job[], key: SortKey, dir: 1 | -1): Job[] {
  return [...jobs].sort((a, b) => {
    const primary =
      key === "source"
        ? (sourceRank(a.source) - sourceRank(b.source)) * dir
        : key === "workMode"
          ? (MODE_RANK[a.workMode] - MODE_RANK[b.workMode]) * dir
          : compareText(a[key], b[key]) * dir;
    if (primary !== 0) return primary;
    if (key !== "source") {
      const bySource = sourceRank(a.source) - sourceRank(b.source);
      if (bySource !== 0) return bySource;
    }
    if (key !== "title") {
      const byTitle = compareText(a.title, b.title);
      if (byTitle !== 0) return byTitle;
    }
    return compareText(a.company, b.company);
  });
}

export function sourceLabel(source: Source): string {
  return SOURCE_META.find((item) => item.id === source)?.label ?? source;
}

export function sourceRank(source: Source): number {
  return SOURCE_RANK.get(source) ?? SOURCES.length;
}

export function isSource(value: string): value is Source {
  return (SOURCES as readonly string[]).includes(value);
}

export function normalizeSlug(source: Source, slug: string): string | null {
  const trimmed = slug.trim();
  const value = HOST_SOURCES.has(source) ? trimmed.toLowerCase() : trimmed;
  const ok = HOST_SOURCES.has(source) ? HOST_SLUG.test(value) : PATH_SLUG.test(value);
  return ok ? value : null;
}

export function parseCompanies(input: unknown): Company[] {
  if (!Array.isArray(input)) return [];
  const companies: Company[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim().slice(0, 80) : "";
    const source = typeof record.source === "string" ? record.source.trim() : "";
    const slugRaw = typeof record.slug === "string" ? record.slug : "";
    if (!name || !isSource(source)) continue;
    const slug = normalizeSlug(source, slugRaw);
    if (!slug) continue;
    companies.push({ name, source, slug });
  }
  return companies;
}

export function companyKey(company: Company): string {
  return `${company.source}:${company.slug.toLowerCase()}`;
}

export function validateSearchInput(input: unknown): { query: string; companies: Company[] } {
  if (!input || typeof input !== "object") throw new Error("Invalid search.");
  const record = input as Record<string, unknown>;
  if (typeof record.query !== "string") throw new Error("Enter a job title.");
  const query = record.query.trim().slice(0, 120);
  if (query.length < 2) throw new Error("Enter at least 2 characters.");
  const companies = parseCompanies(record.companies).slice(0, 80);
  if (companies.length === 0) throw new Error("Add at least one board.");
  return { query, companies };
}
