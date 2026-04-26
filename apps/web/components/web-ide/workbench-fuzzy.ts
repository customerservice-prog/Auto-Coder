/** Subsequence fuzzy score: higher = better match. 0 = no match. */

export function fuzzyScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 1;
  let qi = 0;
  let score = 0;
  let prev = -2;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      score += i === prev + 1 ? 6 : 2;
      if (i === qi) score += 1;
      prev = i;
      qi++;
    }
  }
  if (qi < q.length) return 0;
  return score;
}

export function sortByFuzzy<T>(query: string, rows: T[], getText: (row: T) => string): T[] {
  const q = query.trim();
  if (!q) return rows;
  return [...rows]
    .map((row) => ({ row, s: fuzzyScore(q, getText(row)) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.row);
}
