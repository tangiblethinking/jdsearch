export type WorkMode = "remote" | "hybrid" | "office" | "unknown";

export type FilterableJob = { country: string; workMode: WorkMode; source?: string };

export const WORK_MODES: WorkMode[] = ["remote", "hybrid", "office", "unknown"];

export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  office: "Office",
  unknown: "Unlisted",
};

export const MODE_RANK: Record<WorkMode, number> = { remote: 0, hybrid: 1, office: 2, unknown: 3 };

export type Classified = { country: string; workMode: WorkMode };

export type JobFilters = {
  modes: ReadonlySet<WorkMode>;
  countries: ReadonlySet<string>;
  sources: ReadonlySet<string>;
};

export function emptyFilters(): JobFilters {
  return { modes: new Set(), countries: new Set(), sources: new Set() };
}

export function filtersAreActive(filters: JobFilters): boolean {
  return filters.modes.size > 0 || filters.countries.size > 0 || filters.sources.size > 0;
}

export function filterJobs<T extends FilterableJob>(jobs: T[], filters: JobFilters): T[] {
  if (!filtersAreActive(filters)) return jobs;
  return jobs.filter((job) => {
    if (filters.modes.size > 0 && !filters.modes.has(job.workMode)) return false;
    if (filters.countries.size > 0 && !filters.countries.has(job.country)) return false;
    if (filters.sources.size > 0 && !filters.sources.has(job.source ?? "")) return false;
    return true;
  });
}

export function uniqueCountries(jobs: FilterableJob[]): string[] {
  return [...new Set(jobs.map((job) => job.country).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
}

export function uniqueWorkModes(jobs: FilterableJob[]): WorkMode[] {
  const seen = new Set(jobs.map((job) => job.workMode));
  return WORK_MODES.filter((mode) => seen.has(mode));
}

export function uniqueSources(jobs: FilterableJob[]): string[] {
  return [...new Set(jobs.map((job) => job.source).filter((source): source is string => Boolean(source)))];
}

export function toggleFilterValue<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

const US_STATES = new Set([
  "al", "ak", "az", "ar", "ca", "co", "ct", "dc", "de", "fl", "ga", "hi", "ia", "id", "il", "in",
  "ks", "ky", "la", "ma", "md", "me", "mi", "mn", "mo", "ms", "mt", "nc", "nd", "ne", "nh", "nj",
  "nm", "nv", "ny", "oh", "ok", "or", "pa", "ri", "sc", "sd", "tn", "tx", "ut", "va", "vt", "wa",
  "wi", "wv", "wy", "usa", "us", "united states", "united states of america", "america",
]);

const COUNTRY_ALIASES: Record<string, string> = {
  uk: "United Kingdom",
  gb: "United Kingdom",
  "united kingdom": "United Kingdom",
  "great britain": "United Kingdom",
  england: "United Kingdom",
  scotland: "United Kingdom",
  wales: "United Kingdom",
  "northern ireland": "United Kingdom",
  canada: "Canada",
  germany: "Germany",
  de: "Germany",
  france: "France",
  fr: "France",
  netherlands: "Netherlands",
  "the netherlands": "Netherlands",
  nl: "Netherlands",
  ireland: "Ireland",
  ie: "Ireland",
  australia: "Australia",
  au: "Australia",
  "new zealand": "New Zealand",
  nz: "New Zealand",
  india: "India",
  singapore: "Singapore",
  sg: "Singapore",
  japan: "Japan",
  jp: "Japan",
  spain: "Spain",
  es: "Spain",
  italy: "Italy",
  it: "Italy",
  portugal: "Portugal",
  pt: "Portugal",
  brazil: "Brazil",
  br: "Brazil",
  mexico: "Mexico",
  mx: "Mexico",
  sweden: "Sweden",
  se: "Sweden",
  norway: "Norway",
  no: "Norway",
  denmark: "Denmark",
  dk: "Denmark",
  finland: "Finland",
  fi: "Finland",
  switzerland: "Switzerland",
  ch: "Switzerland",
  austria: "Austria",
  at: "Austria",
  belgium: "Belgium",
  be: "Belgium",
  poland: "Poland",
  pl: "Poland",
  israel: "Israel",
  il: "Israel",
  "united arab emirates": "United Arab Emirates",
  uae: "United Arab Emirates",
  ae: "United Arab Emirates",
  "south korea": "South Korea",
  kr: "South Korea",
  china: "China",
  cn: "China",
  "hong kong": "Hong Kong",
  hk: "Hong Kong",
};

const REMOTE_RE = /\b(remote|work from home|wfh|anywhere|distributed|telecommut)\b/i;
const HYBRID_RE = /\bhybrid\b/i;
const OFFICE_RE = /\b(on[-\s]?site|in[-\s]?office|office|hq)\b/i;

function normalizeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()[\]{}]/g, " ")
    .replace(/\b(remote|hybrid|on[-\s]?site|in[-\s]?office)\b/g, " ")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

function countryFromToken(token: string): string {
  if (!token) return "";
  if (US_STATES.has(token)) return "United States";
  return COUNTRY_ALIASES[token] ?? "";
}

export function classifyLocation(location: string): Classified {
  const raw = location.trim();
  if (!raw) return { country: "Unlisted", workMode: "unknown" };

  const hybrid = HYBRID_RE.test(raw);
  const remote = REMOTE_RE.test(raw);
  const officeHint = OFFICE_RE.test(raw);

  let workMode: WorkMode = "unknown";
  if (hybrid) workMode = "hybrid";
  else if (remote && !officeHint) workMode = "remote";
  else if (officeHint) workMode = "office";

  const parts = raw.split(/[,|/·•;]+/).map((part) => part.trim()).filter(Boolean);
  let country = "";
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const token = normalizeToken(parts[i] ?? "");
    country = countryFromToken(token);
    if (country) break;
    const words = token.split(" ").filter(Boolean);
    if (words.length > 1) {
      country = countryFromToken(words[words.length - 1] ?? "");
      if (country) break;
    }
  }

  if (!country && remote && !hybrid) country = "Remote";
  if (!country) country = workMode === "unknown" ? "Unlisted" : "Remote";
  if (workMode === "unknown" && country !== "Remote" && country !== "Unlisted") workMode = "office";
  return { country, workMode };
}
