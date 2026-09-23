import { type FormEvent } from "react";
import { ChevronDown, Plus, RotateCcw } from "lucide-react";
import { SOURCE_META, companyKey, isSource, sourceLabel, type Source } from "@/lib/jobs";
import type { Board } from "./search-shared";

export function BoardsPanel({
  boards,
  listed,
  disabled,
  activeCount,
  open,
  onToggleOpen,
  addName,
  addSource,
  addSlug,
  addError,
  sourceHint,
  onAddName,
  onAddSource,
  onAddSlug,
  onAdd,
  onToggleBoard,
  onRemove,
  onRestore,
}: {
  boards: Board[] | null;
  listed: Board[];
  disabled: Set<string>;
  activeCount: number;
  open: boolean;
  onToggleOpen: () => void;
  addName: string;
  addSource: Source;
  addSlug: string;
  addError: string;
  sourceHint: string;
  onAddName: (value: string) => void;
  onAddSource: (value: Source) => void;
  onAddSlug: (value: string) => void;
  onAdd: (event: FormEvent) => void;
  onToggleBoard: (board: Board) => void;
  onRemove: (key: string) => void;
  onRestore: () => void;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggleOpen}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-medium text-ink">Boards</span>
          <span className="block text-sm text-muted">
            Add a company from its careers URL. Built-in boards can be turned off, not deleted.
          </span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && boards ? (
        <div className="flex flex-col gap-4 border-t border-line px-4 py-4">
          <form onSubmit={onAdd} className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={addName}
                onChange={(event) => onAddName(event.target.value)}
                placeholder="Company"
                aria-label="Company name"
                className="min-h-11 w-full rounded-sm border border-line bg-bg px-3 text-sm sm:flex-1"
              />
              <select
                value={addSource}
                onChange={(event) => {
                  if (isSource(event.target.value)) onAddSource(event.target.value);
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
                onChange={(event) => onAddSlug(event.target.value)}
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
            <p className="text-sm text-muted tabular-nums">{activeCount} included in the next search</p>
            <button type="button" onClick={onRestore} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent">
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
                      <input type="checkbox" checked={on} onChange={() => onToggleBoard(board)} className="size-4" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-ink">{board.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {sourceLabel(board.source)} · {board.slug}
                          {board.builtin ? "" : " · added"}
                        </span>
                      </span>
                    </label>
                    {board.builtin ? null : (
                      <button type="button" onClick={() => onRemove(key)} className="min-h-11 shrink-0 px-2 text-sm text-muted">
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
  );
}
