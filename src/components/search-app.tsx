import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, Plus, RotateCcw, Search } from "lucide-react";
import { searchJobs } from "@/lib/jobs.functions";
import {
  SOURCE_META,
  companyKey,
  isSource,
  normalizeSlug,
  parseCompanies,
  sortJobs,
  sourceLabel,
  sourceRank,
  type BoardFailure,
  type Company,
  type Job,
  type SortKey,
  type Source,
} from "@/lib/jobs";

const STORE_KEY = "boardline-boards-v1";
const CHUNK = 6;
const RESULT_CAP = 400;
const SUGGESTIONS = [
  "Director of Product Design",
  "Product Designer",
  "Staff Product Designer",
  "Design Manager",
];

type Board = Company & { builtin: boolean };
type Phase = "idle" | "loading" | "done" | "error";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "company", label: "Company" },
  { key: "title", label: "Title" },
  { key: "location", label: "Location" },
  { key: "updated", label: "Updated" },
];

function loadStore(): { added: Company[]; disabled: string[] } {
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

function readableError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  const clean = raw.replace(/^Error:\s*/, "").trim();
  if (clean && clean.length < 140 && !/server function|unexpected|fetch failed/i.test(clean)) return clean;
  return "The search stopped early. Anything already found is still listed.";
}

function formatUpdated(value: string): string {
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

function groupJobs(jobs: Job[]): { source: Source; jobs: Job[] }[] {
  const groups: { source: Source; jobs: Job[] }[] = [];
  for (const job of jobs) {
    const last = groups.at(-1);
    if (!last || last.source !== job.source) groups.push({ source: job.source, jobs: [job] });
    else last.jobs.push(job);
  }
  return groups;
}

export function SearchApp({ query, onQuery }: { query: string; onQuery: (next: string) => void }) {
  const [draft, setDraft] = useState(query);
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [disabled, setDisabled] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [boardsOpen, setBoardsOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addSource, setAddSource] = useState<Source>("greenhouse");
  const [addSlug, setAddSlug] = useState("");
  const [addError, setAddError] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [failed, setFailed] = useState<BoardFailure[]>([]);
  const [checked, setChecked] = useState(0);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showMisses, setShowMisses] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("source");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const baseRef = useRef<Company[]>([]);
  const runId = useRef(0);
  const booted = useRef(false);

  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const response = await fetch("/companies.json");
        if (!response.ok) throw new Error("status");
        const base = parseCompanies(await response.json());
        const store = loadStore();
        if (cancel) return;
        const map = new Map<string, Board>();
        for (const company of base) map.set(companyKey(company), { ...company, builtin: true });
        for (const company of store.added) {
          const key = companyKey(company);
          if (!map.has(key)) map.set(key, { ...company, builtin: false });
        }
        baseRef.current = base;
        setDisabled(new Set(store.disabled));
        setBoards([...map.values()]);
        setReady(true);
      } catch {
        if (!cancel) setLoadError("The board list didn’t load. Refresh and try again.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !boards) return;
    const added = boards
      .filter((board) => !board.builtin)
      .map(({ name, source, slug }) => ({ name, source, slug }));
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ added, disabled: [...disabled] }));
    } catch {
      /* private mode */
    }
  }, [ready, boards, disabled]);

  const active = useMemo(
    () => (boards ?? []).filter((board) => !disabled.has(companyKey(board))),
    [boards, disabled],
  );

  async function execute(queryText: string, list: Company[]) {
    const id = ++runId.current;
    const q = queryText.trim().slice(0, 120);
    if (q.length < 2) {
      setPhase("error");
      setError("Enter at least 2 characters.");
      setNotice("");
      return;
    }
    const queued = list.slice(0, 80);
    if (queued.length === 0) {
      setPhase("error");
      setError("Turn on at least one board.");
      setNotice("");
      return;
    }
    setPhase("loading");
    setError("");
    setNotice(list.length > 80 ? "Only the first 80 boards are searched." : "");
    setJobs([]);
    setFailed([]);
    setChecked(0);
    setTotal(queued.length);
    setCursor("Checking boards…");
    setShowMisses(false);
    setSortKey("source");
    setSortDir(1);
    onQuery(q);

    const acc: Job[] = [];
    const misses: BoardFailure[] = [];
    try {
      for (let i = 0; i < queued.length; i += CHUNK) {
        if (runId.current !== id) return;
        const slice = queued.slice(i, i + CHUNK);
        setCursor(slice.map((company) => company.name).join(", "));
        const payload = await searchJobs({ data: { query: q, companies: slice } });
        if (runId.current !== id) return;
        acc.push(...payload.jobs);
        misses.push(...payload.failed);
        setJobs(acc.slice());
        setFailed(misses.slice());
        setChecked(i + slice.length);
      }
      if (runId.current !== id) return;
      setCursor("");
      setPhase("done");
    } catch (err) {
      if (runId.current !== id) return;
      setCursor("");
      setPhase(acc.length > 0 ? "done" : "error");
      setError(readableError(err));
    }
  }

  useEffect(() => {
    if (!boards || booted.current) return;
    booted.current = true;
    const q = query.trim();
    if (q.length < 2) return;
    const list = boards.filter((board) => !disabled.has(companyKey(board)));
    void execute(q, list);
    // Initial URL search only. Later edits go through the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boards, disabled]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!boards) return;
    void execute(draft, active);
  }

  function onSort(key: SortKey) {
    if (sortKey === key) setSortDir((dir) => (dir === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  function toggleBoard(board: Board) {
    const key = companyKey(board);
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!boards) return;
    const name = addName.trim();
    const slug = normalizeSlug(addSource, addSlug);
    if (!name) {
      setAddError("Name the company.");
      return;
    }
    if (!slug) {
      setAddError("Slug doesn’t match this source. Use the token from the careers URL.");
      return;
    }
    const next: Board = { name: name.slice(0, 80), source: addSource, slug, builtin: false };
    if (boards.some((board) => companyKey(board) === companyKey(next))) {
      setAddError("That board is already listed.");
      return;
    }
    if (boards.length >= 80) {
      setAddError("80 boards is the limit.");
      return;
    }
    setBoards([...boards, next]);
    setAddName("");
    setAddSlug("");
    setAddError("");
  }

  function restoreBoards() {
    setBoards(baseRef.current.map((company) => ({ ...company, builtin: true })));
    setDisabled(new Set());
    setAddError("");
  }

  const sorted = useMemo(() => sortJobs(jobs, sortKey, sortDir), [jobs, sortKey, sortDir]);
  const visible = sorted.slice(0, RESULT_CAP);
  const grouped = sortKey === "source";
  const groups = grouped ? groupJobs(visible) : [];
  const sourceHint = SOURCE_META.find((item) => item.id === addSource)?.hint ?? "";
  const listed = [...(boards ?? [])].sort((a, b) => {
    const bySource = sourceRank(a.source) - sourceRank(b.source);
    return bySource !== 0 ? bySource : a.name.localeCompare(b.name);
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium text-accent">Public job boards</p>
        <h1 className="font-serif text-4xl leading-tight font-medium tracking-tight text-ink sm:text-5xl">
          Boardline
        </h1>
        <p className="max-w-xl text-base text-muted">
          Search one title across company boards. Matches must include every word. Small words like of, the,
          and a are ignored.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="q">
            Job title
          </label>
          <input
            id="q"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Director of Product Design"
            autoComplete="off"
            enterKeyHint="search"
            className="min-h-11 w-full rounded-sm border border-line bg-bg px-3 text-base text-ink placeholder:text-muted"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg"
          >
            <Search className="size-4" aria-hidden="true" />
            {phase === "loading" ? "Searching" : "Search"}
          </button>
        </div>
        <p className="text-sm text-muted tabular-nums">
          {boards ? `${active.length} of ${boards.length} boards on` : "Loading boards…"}
          {loadError ? ` · ${loadError}` : ""}
        </p>
      </form>

      {phase === "idle" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-ink">Try a title</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((title) => (
              <button
                key={title}
                type="button"
                onClick={() => {
                  setDraft(title);
                  if (boards) void execute(title, active);
                }}
                className="min-h-11 rounded-full border border-line bg-surface px-4 text-sm text-ink"
              >
                {title}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <section className="rounded-xl border border-line bg-surface">
        <button
          type="button"
          aria-expanded={boardsOpen}
          onClick={() => setBoardsOpen((open) => !open)}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span>
            <span className="block text-sm font-medium text-ink">Boards</span>
            <span className="block text-sm text-muted">
              Add a company from its careers URL. Built-in boards can be turned off, not deleted.
            </span>
          </span>
          <ChevronDown
            className={`size-4 shrink-0 text-muted motion-safe:transition-transform motion-safe:duration-200 ${boardsOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {boardsOpen && boards ? (
          <div className="flex flex-col gap-4 border-t border-line px-4 py-4">
            <form onSubmit={onAdd} className="flex flex-col gap-2">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={addName}
                  onChange={(event) => setAddName(event.target.value)}
                  placeholder="Company"
                  aria-label="Company name"
                  className="min-h-11 w-full rounded-sm border border-line bg-bg px-3 text-sm sm:flex-1"
                />
                <select
                  value={addSource}
                  onChange={(event) => {
                    if (isSource(event.target.value)) setAddSource(event.target.value);
                  }}
                  aria-label="Board source"
                  className="min-h-11 rounded-sm border border-line bg-bg px-3 text-sm sm:w-40"
                >
                  {SOURCE_META.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <input
                  value={addSlug}
                  onChange={(event) => setAddSlug(event.target.value)}
                  placeholder="slug"
                  aria-label="Board slug"
                  className="min-h-11 w-full rounded-sm border border-line bg-bg px-3 text-sm sm:flex-1"
                />
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-line px-4 text-sm font-medium text-ink"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add
                </button>
              </div>
              <p className="text-sm text-muted">{sourceHint}</p>
              {addError ? <p className="text-sm text-ink">{addError}</p> : null}
            </form>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted tabular-nums">{active.length} included in the next search</p>
              <button
                type="button"
                onClick={restoreBoards}
                className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Restore defaults
              </button>
            </div>
            <ul className="max-h-80 overflow-auto rounded-sm border border-line">
              {listed.map((board) => {
                const key = companyKey(board);
                const on = !disabled.has(key);
                return (
                  <li key={key} className="border-b border-line last:border-b-0">
                    <div className="flex min-h-11 items-center gap-3 px-3">
                      <label className="flex min-w-0 flex-1 items-center gap-3 py-2">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleBoard(board)}
                          className="size-4"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-ink">{board.name}</span>
                          <span className="block truncate text-xs text-muted">
                            {sourceLabel(board.source)} · {board.slug}
                            {board.builtin ? "" : " · added"}
                          </span>
                        </span>
                      </label>
                      {board.builtin ? null : (
                        <button
                          type="button"
                          onClick={() => setBoards(boards.filter((item) => companyKey(item) !== key))}
                          className="min-h-11 shrink-0 px-2 text-sm text-muted"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      {phase !== "idle" ? (
        <section className="flex flex-col gap-3" aria-live="polite">
          {phase === "loading" ? (
            checked === 0 ? (
              <div className="relative h-1 overflow-hidden rounded-sm bg-line" role="progressbar">
                <div className="boardline-scan absolute inset-y-0 w-1/3 bg-accent" />
              </div>
            ) : (
              <div
                className="h-1 overflow-hidden rounded-sm bg-line"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={checked}
              >
                <div className="bl-bar h-full bg-accent" style={{ width: `${total ? (checked / total) * 100 : 0}%` }} />
              </div>
            )
          ) : null}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm text-ink tabular-nums">
              {phase === "loading"
                ? `Checked ${checked} of ${total}`
                : `${jobs.length} role${jobs.length === 1 ? "" : "s"}`}
              {failed.length > 0 ? ` · ${failed.length} board${failed.length === 1 ? "" : "s"} missed` : ""}
              {sorted.length > RESULT_CAP ? ` · showing ${RESULT_CAP}` : ""}
            </p>
            {failed.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowMisses((open) => !open)}
                className="min-h-11 text-sm font-medium text-accent"
              >
                {showMisses ? "Hide missed boards" : "Show missed boards"}
              </button>
            ) : null}
          </div>
          {phase === "loading" && cursor ? <p className="text-sm text-muted">{cursor}</p> : null}
          {notice ? <p className="text-sm text-muted">{notice}</p> : null}
          {error ? <p className="text-sm text-ink">{error}</p> : null}
          {showMisses ? (
            <ul className="flex flex-col gap-1 text-sm text-muted">
              {failed.map((board) => (
                <li key={`${board.source}:${board.slug}`}>
                  {board.name} · {sourceLabel(board.source)} · {board.slug}
                </li>
              ))}
            </ul>
          ) : null}

          {phase === "loading" && jobs.length === 0 ? (
            <div className="flex flex-col gap-2" aria-hidden="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="bl-skel h-14 rounded-md" />
              ))}
            </div>
          ) : null}

          {phase === "done" && jobs.length === 0 && !error ? (
            <p className="rounded-lg border border-line bg-surface px-4 py-6 text-sm text-muted">
              No titles on the selected boards include every word. Try a shorter title, or add a board.
            </p>
          ) : null}

          {visible.length > 0 ? (
            <>
              <div className="flex gap-2 overflow-x-auto md:hidden">
                {COLUMNS.map((column) => {
                  const activeSort = sortKey === column.key;
                  return (
                    <button
                      key={column.key}
                      type="button"
                      onClick={() => onSort(column.key)}
                      className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border px-4 text-sm ${
                        activeSort ? "border-accent text-accent" : "border-line text-muted"
                      }`}
                    >
                      {column.label}
                      {activeSort ? (
                        sortDir === 1 ? (
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        )
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <ul className="flex flex-col gap-2 md:hidden">
                {(grouped ? groups.flatMap((group) => group.jobs) : visible).map((job, index) => (
                  <li key={`${job.url}-${job.company}-${job.title}-${index}`}>
                    <JobCard job={job} />
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Matching roles sorted by {sortKey} {sortDir === 1 ? "ascending" : "descending"}
                  </caption>
                  <thead>
                    <tr className="border-b border-line">
                      {COLUMNS.map((column) => {
                        const activeSort = sortKey === column.key;
                        return (
                          <th key={column.key} aria-sort={activeSort ? (sortDir === 1 ? "ascending" : "descending") : "none"} className="px-3 py-1 font-medium">
                            <button
                              type="button"
                              onClick={() => onSort(column.key)}
                              className="inline-flex min-h-11 items-center gap-1 text-muted"
                            >
                              {column.label}
                              {activeSort ? (
                                sortDir === 1 ? (
                                  <ArrowUp className="size-3.5" aria-hidden="true" />
                                ) : (
                                  <ArrowDown className="size-3.5" aria-hidden="true" />
                                )
                              ) : null}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {grouped
                      ? groups.map((group) => (
                          <GroupRows key={group.source} source={group.source} jobs={group.jobs} />
                        ))
                      : visible.map((job, index) => (
                          <JobRow key={`${job.url}-${job.company}-${job.title}-${index}`} job={job} />
                        ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function JobCard({ job }: { job: Job }) {
  const when = formatUpdated(job.updated);
  return (
    <article className="flex flex-col gap-1 rounded-lg border border-line bg-surface px-4 py-3">
      <p className="text-xs text-muted">
        {sourceLabel(job.source)} · {job.company}
      </p>
      <TitleLink job={job} />
      <p className="text-sm text-muted">
        {job.location || "Location not listed"}
        {when ? ` · ${when}` : ""}
      </p>
    </article>
  );
}

function GroupRows({ source, jobs }: { source: Source; jobs: Job[] }) {
  return (
    <>
      <tr>
        <td colSpan={5} className="bg-bg px-3 py-2 text-xs font-medium text-muted">
          {sourceLabel(source)}
          <span className="tabular-nums"> · {jobs.length}</span>
        </td>
      </tr>
      {jobs.map((job, index) => (
        <JobRow key={`${job.url}-${job.title}-${index}`} job={job} />
      ))}
    </>
  );
}

function JobRow({ job }: { job: Job }) {
  const when = formatUpdated(job.updated);
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-3 py-3 text-muted">{sourceLabel(job.source)}</td>
      <td className="px-3 py-3 text-ink">{job.company}</td>
      <td className="px-3 py-3">
        <TitleLink job={job} />
      </td>
      <td className="px-3 py-3 text-muted">{job.location || "—"}</td>
      <td className="px-3 py-3 whitespace-nowrap text-muted tabular-nums">{when || "—"}</td>
    </tr>
  );
}

function TitleLink({ job }: { job: Job }) {
  if (!job.url.startsWith("https://")) {
    return <span className="text-ink">{job.title}</span>;
  }
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-start gap-1 text-ink underline decoration-line underline-offset-2"
    >
      <span>{job.title}</span>
      <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
    </a>
  );
}
