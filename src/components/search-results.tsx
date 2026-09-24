import { ArrowDown, ArrowUp } from "lucide-react";
import { FilterChips } from "@/components/filter-chips";
import { sourceLabel, type BoardFailure, type Job, type JobFilters, type SortKey, type Source, type WorkMode } from "@/lib/jobs";
import { COLUMNS, RESULT_CAP, type Phase } from "./search-shared";
import { GroupRows, JobCard, JobRow } from "./job-views";

function Pager({
  page,
  pageCount,
  from,
  to,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-2" aria-label="Results pages">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(Math.max(1, page - 1))}
        className="min-h-11 rounded-sm border border-line px-4 text-sm text-ink disabled:opacity-40"
      >
        Previous
      </button>
      <p className="text-sm text-muted tabular-nums">
        {from}–{to} of {total} · Page {page} of {pageCount}
      </p>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPage(Math.min(pageCount, page + 1))}
        className="min-h-11 rounded-sm bg-accent px-4 text-sm font-medium text-accent-fg disabled:bg-surface disabled:text-ink disabled:opacity-40 disabled:border disabled:border-line"
      >
        Next
      </button>
    </nav>
  );
}

export function SearchResults({
  phase,
  checked,
  total,
  cursor,
  notice,
  error,
  jobs,
  failed,
  filteredCount,
  sortedCount,
  filterActive,
  showMisses,
  onToggleMisses,
  modeOptions,
  countryOptions,
  sourceOptions,
  filters,
  onFilters,
  visible,
  grouped,
  groups,
  sortKey,
  sortDir,
  onSort,
  page,
  pageCount,
  pageSize,
  onPage,
}: {
  phase: Phase;
  checked: number;
  total: number;
  cursor: string;
  notice: string;
  error: string;
  jobs: Job[];
  failed: BoardFailure[];
  filteredCount: number;
  sortedCount: number;
  filterActive: boolean;
  showMisses: boolean;
  onToggleMisses: () => void;
  modeOptions: WorkMode[];
  countryOptions: string[];
  sourceOptions: Source[];
  filters: JobFilters;
  onFilters: (next: JobFilters) => void;
  visible: Job[];
  grouped: boolean;
  groups: { source: Source; jobs: Job[] }[];
  sortKey: SortKey;
  sortDir: 1 | -1;
  onSort: (key: SortKey) => void;
  page: number;
  pageCount: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const from = sortedCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, sortedCount);
  const showPager = sortedCount > 0;

  return (
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
            : filterActive
              ? `${filteredCount} of ${jobs.length} role${jobs.length === 1 ? "" : "s"}`
              : `${jobs.length} role${jobs.length === 1 ? "" : "s"}`}
          {failed.length > 0 ? ` · ${failed.length} board${failed.length === 1 ? "" : "s"} missed` : ""}
          {sortedCount > RESULT_CAP ? ` · capped at ${RESULT_CAP}` : ""}
        </p>
        {failed.length > 0 ? (
          <button type="button" onClick={onToggleMisses} className="min-h-11 text-sm font-medium text-accent">
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
      {jobs.length > 0 ? (
        <FilterChips
          modes={modeOptions}
          countries={countryOptions}
          sources={sourceOptions}
          filters={filters}
          onChange={onFilters}
        />
      ) : null}
      {jobs.length > 0 && filteredCount === 0 ? (
        <p className="rounded-lg border border-line bg-surface px-4 py-6 text-sm text-muted">
          No roles match these filters. Clear a chip or choose another source.
        </p>
      ) : null}
      {visible.length > 0 ? (
        <>
          {showPager ? <Pager page={page} pageCount={pageCount} from={from} to={to} total={sortedCount} onPage={onPage} /> : null}
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
                      <th
                        key={column.key}
                        aria-sort={activeSort ? (sortDir === 1 ? "ascending" : "descending") : "none"}
                        className="px-3 py-1 font-medium"
                      >
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
                  ? groups.map((group) => <GroupRows key={group.source} source={group.source} jobs={group.jobs} />)
                  : visible.map((job, index) => (
                      <JobRow key={`${job.url}-${job.company}-${job.title}-${index}`} job={job} />
                    ))}
              </tbody>
            </table>
          </div>
          {showPager ? <Pager page={page} pageCount={pageCount} from={from} to={to} total={sortedCount} onPage={onPage} /> : null}
        </>
      ) : null}
    </section>
  );
}
