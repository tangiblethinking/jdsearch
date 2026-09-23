import { classifyLocation } from "./job-filters";
import type { Company, Job, Source } from "./jobs";

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
  const place = location.replace(/\s+/g, " ").trim();
  const classified = classifyLocation(place);
  return {
    source,
    company,
    title: cleanTitle,
    location: place,
    country: classified.country,
    workMode: classified.workMode,
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
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
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
      const next = job(source, company, text(row.title), location, text(row.url) || text(row.shortlink), row.published_on);
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
