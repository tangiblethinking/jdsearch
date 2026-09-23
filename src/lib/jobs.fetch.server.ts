import {
  companyKey,
  matchesTitle,
  normalize,
  normalizeRss,
  significantWords,
  type Company,
  type Job,
  type SearchPayload,
  type Source,
} from "./jobs";

const OK_TTL = 10 * 60 * 1000;
const ERR_TTL = 45 * 1000;
const PAGE_CAP = 200;

type CacheHit = { at: number; jobs: Job[] } | { at: number; error: true };

const cache = new Map<string, CacheHit>();

function boardUrl(company: Company, offset = 0): string {
  const slug = encodeURIComponent(company.slug);
  switch (company.source) {
    case "greenhouse":
      return `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
    case "lever":
      return `https://api.lever.co/v0/postings/${slug}?mode=json`;
    case "ashby":
      return `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`;
    case "workable":
      return `https://apply.workable.com/api/v1/widget/accounts/${slug}`;
    case "smartrecruiters":
      return `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100&offset=${offset}`;
    case "recruitee":
      return `https://${company.slug}.recruitee.com/api/offers/`;
    case "breezy":
      return `https://${company.slug}.breezy.hr/json`;
    case "teamtailor":
      return `https://${company.slug}.teamtailor.com/jobs.rss`;
  }
}

async function readBoard(url: string): Promise<{ ok: boolean; text: string }> {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
    headers: {
      accept: "application/json, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "user-agent": "Boardline/1.0",
    },
  });
  return { ok: response.ok, text: await response.text() };
}

function parseJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}

function jobsFromRaw(company: Company, text: string): Job[] {
  if (company.source === "teamtailor" || text.trimStart().startsWith("<")) {
    return normalizeRss(company, text);
  }
  return normalize(company.source, company.name, parseJson(text), company.slug);
}

async function fetchSmartRecruiters(company: Company): Promise<Job[]> {
  const collected: unknown[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;
  while (collected.length < total && collected.length < PAGE_CAP) {
    const { ok, text } = await readBoard(boardUrl(company, offset));
    if (!ok) throw new Error("status");
    const raw = parseJson(text) as { content?: unknown; totalFound?: unknown };
    const page = Array.isArray(raw.content) ? raw.content : [];
    total = typeof raw.totalFound === "number" ? raw.totalFound : page.length;
    collected.push(...page);
    if (page.length === 0) break;
    offset += page.length;
  }
  return normalize("smartrecruiters", company.name, { content: collected });
}

async function loadCompany(company: Company): Promise<Job[]> {
  const key = companyKey(company);
  const hit = cache.get(key);
  if (hit && hit.at > Date.now() - ("error" in hit ? ERR_TTL : OK_TTL)) {
    if ("error" in hit) throw new Error("cached");
    return hit.jobs;
  }
  try {
    const jobs =
      company.source === "smartrecruiters"
        ? await fetchSmartRecruiters(company)
        : await (async () => {
            const { ok, text } = await readBoard(boardUrl(company));
            if (!ok) throw new Error("status");
            return jobsFromRaw(company, text);
          })();
    cache.set(key, { at: Date.now(), jobs });
    return jobs;
  } catch (error) {
    cache.set(key, { at: Date.now(), error: true });
    throw error;
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current] as T);
    }
  }
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

export async function runSearch(query: string, companies: Company[]): Promise<SearchPayload> {
  const words = significantWords(query);
  const settled = await mapPool(companies, 6, async (company) => {
    try {
      const jobs = (await loadCompany(company)).filter((item) => matchesTitle(item.title, words));
      return { jobs, failed: null };
    } catch {
      return {
        jobs: [] as Job[],
        failed: { name: company.name, source: company.source as Source, slug: company.slug },
      };
    }
  });
  return {
    jobs: settled.flatMap((item) => item.jobs),
    checked: companies.length,
    failed: settled.flatMap((item) => (item.failed ? [item.failed] : [])),
  };
}
