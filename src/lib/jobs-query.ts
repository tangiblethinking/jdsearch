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
  return words.every((word) => title.toLowerCase().includes(word));
}
