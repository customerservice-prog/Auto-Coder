export interface SearchHit {
  path: string;
  name: string;
  line: number;
  preview: string;
}

export function scanWorkspaceFiles(
  files: Record<string, { name: string; content: string }>,
  q: string,
  caseSensitive: boolean,
  wholeWord: boolean,
  pathIncludeFragments: string[],
): SearchHit[] {
  const raw = q.trim();
  if (!raw) return [];
  const hits: SearchHit[] = [];
  const needle = caseSensitive ? raw : raw.toLowerCase();
  const fragments = pathIncludeFragments
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  for (const [path, buf] of Object.entries(files)) {
    if (fragments.length > 0) {
      const pl = path.toLowerCase();
      if (!fragments.every((f) => pl.includes(f))) continue;
    }
    const lines = buf.content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const hay = caseSensitive ? line : line.toLowerCase();
      let ok = hay.includes(needle);
      if (ok && wholeWord) {
        try {
          const re = new RegExp(
            `\\b${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
            caseSensitive ? '' : 'i',
          );
          ok = re.test(line);
        } catch {
          ok = false;
        }
      }
      if (ok) {
        hits.push({
          path,
          name: buf.name,
          line: i + 1,
          preview: line.trim().slice(0, 200),
        });
      }
    }
  }
  return hits.slice(0, 300);
}
