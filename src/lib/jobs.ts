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

const STOP = new Set(["of", "the", "a", "an", "and", "for", "in", "at", "to", "or", "on", "with"]);

const PATH_SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;
const HOST_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export type SortKey = "source" | "company" | "title" | "location" | "updated";

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export function sortJobs(jobs: Job[], key: SortKey, dir: 1 | -1): Job[] {
  return [...jobs].sort((a, b) => {
    const primary =
      key === "source"
        ? (sourceRank(a.source) - sourceRank(b.source)) * dir
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
