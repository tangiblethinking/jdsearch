# ATS Job Title Search App

Search a job title across public ATS boards. Return a list. Sort by source (endpoint).

**No API keys.** Each ATS is per-company. You query boards you list, then filter by title.

Skip iCIMS / JazzHR / Jobvite here (no clean public JSON). Workday is optional and harder.

---

## 1. What it does

1. User types a title (`Director of Product Design`).
2. App fetches every company board in `companies.json`.
3. Filters jobs whose title matches the query.
4. Renders one table.
5. Sort by: source, company, title, location.

---

## 2. Public endpoints (no auth)

Replace `{slug}` with the company board token.

| Source | Method | URL |
|---|---|---|
| Greenhouse | GET | `https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` |
| Lever | GET | `https://api.lever.co/v0/postings/{slug}?mode=json` |
| Ashby | GET | `https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true` |
| Workable | GET | `https://apply.workable.com/api/v1/widget/accounts/{slug}` |
| SmartRecruiters | GET | `https://api.smartrecruiters.com/v1/companies/{slug}/postings?limit=100` |
| Recruitee | GET | `https://{slug}.recruitee.com/api/offers/` |
| Breezy | GET | `https://{slug}.breezy.hr/json` |
| Teamtailor | GET | `https://{slug}.teamtailor.com/jobs.rss` (RSS) or careers host `/jobs` JSON if published |

Workday (optional):

```
POST https://{tenant}.{dc}.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs
Content-Type: application/json
{"appliedFacets":{},"limit":20,"offset":0,"searchText":"Director of Product Design"}
```

You must copy `tenant`, `dc` (`wd1`/`wd3`/`wd5`), and `site` from the company’s careers URL.

---

## 3. Project

```bash
npm create vite@latest ats-search -- --template vanilla
cd ats-search
```

### `vite.config.js` — proxy (avoids CORS)

```js
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      '/gh': { target: 'https://boards-api.greenhouse.io', changeOrigin: true, rewrite: p => p.replace(/^\/gh/, '') },
      '/lever': { target: 'https://api.lever.co', changeOrigin: true, rewrite: p => p.replace(/^\/lever/, '') },
      '/ashby': { target: 'https://api.ashbyhq.com', changeOrigin: true, rewrite: p => p.replace(/^\/ashby/, '') },
      '/workable': { target: 'https://apply.workable.com', changeOrigin: true, rewrite: p => p.replace(/^\/workable/, '') },
      '/sr': { target: 'https://api.smartrecruiters.com', changeOrigin: true, rewrite: p => p.replace(/^\/sr/, '') },
    }
  }
})
```

Recruitee / Breezy / Teamtailor use per-tenant hosts. Fetch those from a tiny backend or Cloudflare Worker. For a first version, stick to Greenhouse, Lever, Ashby, Workable, SmartRecruiters via the proxy.

---

## 4. `public/companies.json`

Add slugs as you find them on careers URLs  
(`boards.greenhouse.io/stripe` → greenhouse / `stripe`).

```json
[
  { "name": "Stripe", "source": "greenhouse", "slug": "stripe" },
  { "name": "Airbnb", "source": "greenhouse", "slug": "airbnb" },
  { "name": "Discord", "source": "greenhouse", "slug": "discord" },
  { "name": "GitLab", "source": "greenhouse", "slug": "gitlab" },
  { "name": "HubSpot", "source": "greenhouse", "slug": "hubspot" },
  { "name": "Datadog", "source": "greenhouse", "slug": "datadog" },
  { "name": "Coinbase", "source": "greenhouse", "slug": "coinbase" },
  { "name": "Cloudflare", "source": "greenhouse", "slug": "cloudflare" },
  { "name": "Spotify", "source": "lever", "slug": "spotify" },
  { "name": "Netflix", "source": "lever", "slug": "netflix" },
  { "name": "Palantir", "source": "lever", "slug": "palantir" },
  { "name": "Atlassian", "source": "lever", "slug": "atlassian" },
  { "name": "Ramp", "source": "ashby", "slug": "ramp" },
  { "name": "OpenAI", "source": "ashby", "slug": "openai" },
  { "name": "Linear", "source": "ashby", "slug": "linear" },
  { "name": "Vercel", "source": "ashby", "slug": "vercel" },
  { "name": "Plaid", "source": "ashby", "slug": "plaid" },
  { "name": "Notion", "source": "ashby", "slug": "notion" }
]
```

---

## 5. Fetch + normalize

```js
const proxy = {
  greenhouse: (s) => `/gh/v1/boards/${s}/jobs?content=true`,
  lever: (s) => `/lever/v0/postings/${s}?mode=json`,
  ashby: (s) => `/ashby/posting-api/job-board/${s}?includeCompensation=true`,
  workable: (s) => `/workable/api/v1/widget/accounts/${s}`,
  smartrecruiters: (s) => `/sr/v1/companies/${s}/postings?limit=100`,
}

function normalize(source, company, raw) {
  if (source === 'greenhouse') {
    return (raw.jobs || []).map(j => ({
      source, company,
      title: j.title || '',
      location: j.location?.name || '',
      url: j.absolute_url || '',
      updated: j.updated_at || '',
    }))
  }
  if (source === 'lever') {
    return (Array.isArray(raw) ? raw : []).map(j => ({
      source, company,
      title: j.text || '',
      location: (j.categories && j.categories.location) || '',
      url: j.hostedUrl || j.applyUrl || '',
      updated: j.createdAt ? new Date(j.createdAt).toISOString() : '',
    }))
  }
  if (source === 'ashby') {
    return (raw.jobs || []).map(j => ({
      source, company,
      title: j.title || '',
      location: j.location || j.address?.postalAddress?.addressLocality || '',
      url: j.jobUrl || j.applyUrl || '',
      updated: j.publishedAt || '',
    }))
  }
  if (source === 'workable') {
    return (raw.jobs || []).map(j => ({
      source, company,
      title: j.title || '',
      location: j.city || j.locations?.[0] || '',
      url: j.url || j.shortlink || '',
      updated: j.published_on || '',
    }))
  }
  if (source === 'smartrecruiters') {
    return (raw.content || []).map(j => ({
      source, company,
      title: j.name || '',
      location: j.location?.city || '',
      url: j.ref || j.uuid || '',
      updated: j.releasedDate || '',
    }))
  }
  return []
}

function matchesTitle(title, q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean)
  const t = title.toLowerCase()
  return words.every(w => t.includes(w))
}

export async function searchJobs(query, companies) {
  const settled = await Promise.allSettled(
    companies.map(async (c) => {
      const url = proxy[c.source]?.(c.slug)
      if (!url) return []
      const res = await fetch(url)
      if (!res.ok) return []
      const raw = await res.json()
      return normalize(c.source, c.name, raw)
        .filter(j => matchesTitle(j.title, query))
    })
  )
  return settled.flatMap(s => s.status === 'fulfilled' ? s.value : [])
}
```

---

## 6. UI — search + sortable by source

```html
<input id="q" placeholder="Director of Product Design" />
<button id="go">Search</button>
<p id="status"></p>
<table>
  <thead>
    <tr>
      <th data-sort="source">Source</th>
      <th data-sort="company">Company</th>
      <th data-sort="title">Title</th>
      <th data-sort="location">Location</th>
    </tr>
  </thead>
  <tbody id="rows"></tbody>
</table>
```

```js
let rows = []
let sortKey = 'source'
let sortDir = 1

function render() {
  const sorted = [...rows].sort((a, b) => {
    const av = (a[sortKey] || '').toString().toLowerCase()
    const bv = (b[sortKey] || '').toString().toLowerCase()
    if (av < bv) return -1 * sortDir
    if (av > bv) return 1 * sortDir
    return 0
  })
  document.getElementById('rows').innerHTML = sorted.map(j => `
    <tr>
      <td>${j.source}</td>
      <td>${j.company}</td>
      <td><a href="${j.url}" target="_blank" rel="noreferrer">${j.title}</a></td>
      <td>${j.location}</td>
    </tr>
  `).join('')
}

document.querySelectorAll('th[data-sort]').forEach(th => {
  th.onclick = () => {
    const key = th.dataset.sort
    if (sortKey === key) sortDir *= -1
    else { sortKey = key; sortDir = 1 }
    render()
  }
})

document.getElementById('go').onclick = async () => {
  const q = document.getElementById('q').value.trim()
  if (!q) return
  document.getElementById('status').textContent = 'Searching…'
  const companies = await fetch('/companies.json').then(r => r.json())
  rows = await searchJobs(q, companies)
  document.getElementById('status').textContent = `${rows.length} results`
  sortKey = 'source'
  sortDir = 1
  render()
}
```

Default sort is `source`, so Greenhouse rows group together, then Lever, Ashby, etc.

To sort **within** each source: sort by `source` first, then `title`.

```js
sorted.sort((a, b) => {
  if (a.source !== b.source) return a.source.localeCompare(b.source)
  return a.title.localeCompare(b.title)
})
```

---

## 7. Optional sources (same list shape)

```js
// Recruitee — needs host proxy or Worker
const recruitee = await fetch(`https://${slug}.recruitee.com/api/offers/`)
const jobs = (data.offers || []).map(j => ({
  source: 'recruitee', company,
  title: j.title,
  location: j.location || j.city || '',
  url: j.careers_url || j.careers_apply_url,
  updated: j.published_at || '',
}))

// Breezy — list has no descriptions
const breezy = await fetch(`https://${slug}.breezy.hr/json`)
const jobs = (Array.isArray(data) ? data : []).map(j => ({
  source: 'breezy', company,
  title: j.name || j.title,
  location: j.location?.name || j.location || '',
  url: j.url || `https://${slug}.breezy.hr/p/${j.friendly_id}`,
  updated: j.published_date || '',
}))
```

---

## 8. How to grow coverage

1. Open a company’s careers page.
2. Read the URL:
   - `boards.greenhouse.io/{slug}` → greenhouse
   - `jobs.lever.co/{slug}` → lever
   - `jobs.ashbyhq.com/{slug}` → ashby
   - `apply.workable.com/{slug}` → workable
   - `jobs.smartrecruiters.com/{slug}` → smartrecruiters
   - `{slug}.recruitee.com` → recruitee
   - `{slug}.breezy.hr` → breezy
   - `{slug}.teamtailor.com` → teamtailor
3. Append `{ name, source, slug }` to `companies.json`.

There is no official “all Greenhouse companies” list. Your index is only as wide as this file.

---

## 9. Run

```bash
npm run dev
```

Type a title. Click Search. Click **Source** to group by endpoint.
