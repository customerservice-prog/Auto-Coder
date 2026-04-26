const MAX_ROWS = 30;

/** Turn a multi-line API/agent error into discrete problem rows (capped). */
export function problemRowsFromAgentError(text: string | null): { rows: string[]; totalLines: number } {
  if (text == null || !text.trim()) {
    return { rows: [], totalLines: 0 };
  }
  const raw = text.replace(/\r\n/g, '\n').split('\n').map((l) => l.trimEnd());
  const nonEmpty = raw.filter((l) => l.length > 0);
  const lines = nonEmpty.length > 0 ? nonEmpty : [text.trim()];
  const totalLines = lines.length;
  if (lines.length <= MAX_ROWS) {
    return { rows: lines, totalLines };
  }
  return {
    rows: [...lines.slice(0, MAX_ROWS), `… (${lines.length - MAX_ROWS} more lines)`],
    totalLines,
  };
}
