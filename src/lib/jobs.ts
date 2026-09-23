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

export function significantWords(query: string): string[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
  const meaningful = words.filter((word) => !STOP.has(word));
  return meaningful.length > 0 ? meaningful : words;
}

export function matchesTitle(title: string, words: string[]): boolean {
  if (words.length === 0) return false;
  const haystack = title.toLowerCase();
  return words.every((word) => haystack.includes(word));
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toIso(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
  if (typeof value !== "string" || !value.trim()) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function httpsUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withProto = trimmed.startsWith("http://") ? `https://${trimmed.slice("http://".length)}` : trimmed;
  if (!withProto.startsWith("https://")) return "";
  try {
    const url = new URL(withProto);
    if (url.username || url.password) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function job(source: Source, company: string, title: string, location: string, url: string, updated: unknown): Job | null {
  const cleanTitle = title.replace(/\s+/g, " ").trim();
  if (!cleanTitle) return null;
  return {
    source,
    company,
    title: cleanTitle,
    location: location.replace(/\s+/g, " ").trim(),
    url: httpsUrl(url),
    updated: toIso(updated),
  };
}

function decodeXml(value: string): string {
  const fromCode = (code: number) =>
    Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (entity, digits) => fromCode(Number(digits)) || entity)
    .replace(/&#x([0-9a-f]+);/gi, (entity, digits) => fromCode(Number.parseInt(digits, 16)) || entity)
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&/g, "&")
    .trim();
}

function xmlTag(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXml(match[1] ?? "") : "";
}

export function normalize(source: Source, company: string, raw: unknown, slug = ""): Job[] {
  const record = asRecord(raw);
  if (source === "greenhouse") {
    return asArray(record?.jobs).flatMap((item) => {
      const row = asRecord(item);
      if (!row) return [];
      const location = asRecord(row.location);
      const next = job(source, company, text(row.title), text(location?.name), text(row.absolute_url), row.updated_at);
      return next ? [next] : [];
    });
  }
  if (source === "lever") {
    return asArray(raw).flatMap((item) => {
      const row = asRecord(item);
      if (!row) return [];
      const categories = asRecord(row.categories);
      const all = asArray(categories?.allLocations).map(text).filter(Boolean);
      const location = text(categories?.location) || all.join(" · ");
      const next = job(source, company, text(row.text), location, text(row.hostedUrl) || text(row.applyUrl), row.createdAt);
      return next ? [next] : [];
    });
  }
  if (source === "ashby") {
    return asArray(record?.jobs).flatMap((item) => {
      const row = asRecord(item);
      if (!row) return [];
      const address = asRecord(asRecord(row.address)?.postalAddress);
      const location =
        text(row.location) ||
        [text(address?.addressLocality), text(address?.addressRegion)].filter(Boolean).join(", ");
      const next = job(source, company, text(row.title), location, text(row.jobUrl) || text(row.applyUrl), row.publishedAt);
      return next ? [next] : [];
    });
  }
  if (source === "workable") {
    return asArray(record?.jobs).flatMap((item) => {
      const row = asRecord(item);
      if (!row) return [];
      const places = asArray(row.locations).map(asRecord).filter((place) => place !== null);
      const place = places[0];
      const location = [
        text(row.city) || text(place?.city),
        text(row.state) || text(place?.region) || text(row.country) || text(place?.country),
      ]
        .filter(Boolean)
        .join(", ");
      const next = job(
        source,
        company,
        text(row.title),
        location,
        text(row.url) || text(row.shortlink),
        row.published_on,
      );
      return next ? [next] : [];
    });
  }
  if (source === "smartrecruiters") {
    return asArray(record?.content).flatMap((item) => {
      const row = asRecord(item);
      if (!row) return [];
      const location = asRecord(row.location);
      const org = asRecord(row.company);
      const identifier = text(org?.identifier);
      const id = text(row.id);
      const url = identifier && id ? `https://jobs.smartrecruiters.com/${identifier}/${id}` : "";
      const place = text(location?.fullLocation) || [text(location?.city), text(location?.region)].filter(Boolean).join(", ");
      const next = job(source, company, text(row.name), place, url, row.releasedDate);
      return next ? [next] : [];
    });
  }
  if (source === "recruitee") {
    return asArray(record?.offers).flatMap((item) => {
      const row = asRecord(item);
      if (!row) return [];
      const next = job(
        source,
        company,
        text(row.title),
        text(row.location) || text(row.city),
        text(row.careers_url) || text(row.careers_apply_url),
        row.published_at,
      );
      return next ? [next] : [];
    });
  }
  if (source === "breezy") {
    return asArray(raw).flatMap((item) => {
      const row = asRecord(item);
      if (!row) return [];
      const location = asRecord(row.location);
      const friendly = text(row.friendly_id);
      const url = text(row.url) || (friendly && slug ? `https://${slug}.breezy.hr/p/${friendly}` : "");
      const next = job(
        source,
        company,
        text(row.name) || text(row.title),
        text(location?.name) || text(row.location),
        url,
        row.published_date,
      );
      return next ? [next] : [];
    });
  }
  return [];
}

export function normalizeRss(company: Company, xml: string): Job[] {
  const items = xml.match(/<item\b[^>]*>([\s\S]*?)<\/item>/gi) ?? [];
  return items.flatMap((item) => {
    const next = job(
      "teamtailor",
      company.name,
      xmlTag(item, "title"),
      xmlTag(item, "location") || xmlTag(item, "tt:location"),
      xmlTag(item, "link"),
      xmlTag(item, "pubDate"),
    );
    return next ? [next] : [];
  });
}
