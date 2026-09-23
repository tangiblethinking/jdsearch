import { parseCompanies, type Company } from "./jobs";

const STOP = new Set(["of", "the", "a", "an", "and", "for", "in", "at", "to", "or", "on", "with"]);

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
