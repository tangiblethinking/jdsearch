import {
  WORK_MODE_LABEL,
  emptyFilters,
  sourceLabel,
  toggleFilterValue,
  type JobFilters,
  type Source,
  type WorkMode,
} from "@/lib/jobs";

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-sm ${
        active ? "border-accent bg-accent text-accent-fg" : "border-line text-ink"
      }`}
    >
      {label}
    </button>
  );
}

export function FilterChips({
  modes,
  countries,
  sources,
  filters,
  onChange,
}: {
  modes: WorkMode[];
  countries: string[];
  sources: Source[];
  filters: JobFilters;
  onChange: (next: JobFilters) => void;
}) {
  const active = filters.modes.size > 0 || filters.countries.size > 0 || filters.sources.size > 0;
  return (
    <div className="flex flex-col gap-2">
      {sources.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted">Source</span>
          {sources.map((source) => (
            <Chip
              key={source}
              label={sourceLabel(source)}
              active={filters.sources.has(source)}
              onClick={() => onChange({ ...filters, sources: toggleFilterValue(filters.sources, source) })}
            />
          ))}
        </div>
      ) : null}
      {modes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted">Type</span>
          {modes.map((mode) => (
            <Chip
              key={mode}
              label={WORK_MODE_LABEL[mode]}
              active={filters.modes.has(mode)}
              onClick={() => onChange({ ...filters, modes: toggleFilterValue(filters.modes, mode) })}
            />
          ))}
        </div>
      ) : null}
      {countries.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted">Country</span>
          {countries.map((country) => (
            <Chip
              key={country}
              label={country}
              active={filters.countries.has(country)}
              onClick={() => onChange({ ...filters, countries: toggleFilterValue(filters.countries, country) })}
            />
          ))}
        </div>
      ) : null}
      {active ? (
        <button type="button" onClick={() => onChange(emptyFilters())} className="self-start text-sm font-medium text-accent">
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
