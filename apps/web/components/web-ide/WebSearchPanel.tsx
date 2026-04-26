'use client';

import { useMemo, useState } from 'react';
import { DEMO_BUFFERS } from '@/components/web-ide/demo-workspace';

export interface SearchHit {
  path: string;
  name: string;
  line: number;
  preview: string;
}

function scanWorkspace(q: string, caseSensitive: boolean, wholeWord: boolean): SearchHit[] {
  const raw = q.trim();
  if (!raw) return [];
  const hits: SearchHit[] = [];
  const needle = caseSensitive ? raw : raw.toLowerCase();

  for (const [path, buf] of Object.entries(DEMO_BUFFERS)) {
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
  return hits.slice(0, 200);
}

interface WebSearchPanelProps {
  onOpenFile: (path: string, name: string) => void;
}

export function WebSearchPanel({ onOpenFile }: WebSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [replace, setReplace] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const results = useMemo(
    () => scanWorkspace(query, caseSensitive, wholeWord),
    [query, caseSensitive, wholeWord],
  );

  return (
    <div className="wb-search-workspace">
      <div className="wb-search-fields">
        <input
          className="wb-search-input"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <input
          className="wb-search-input wb-search-replace"
          placeholder="Replace"
          value={replace}
          onChange={(e) => setReplace(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <div className="wb-search-toggles" role="group" aria-label="Search options">
          <label className="wb-search-toggle">
            <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
            <span>Match case</span>
          </label>
          <label className="wb-search-toggle">
            <input type="checkbox" checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} />
            <span>Match whole word</span>
          </label>
        </div>
      </div>
      <p className="wb-search-scope">Demo files only.</p>
      <div className="wb-search-results" role="list">
        {query.trim() === '' ? (
          <p className="wb-search-empty">Enter text to search.</p>
        ) : results.length === 0 ? (
          <p className="wb-search-empty">No results.</p>
        ) : (
          results.map((h, i) => (
            <button
              key={`${h.path}-${h.line}-${i}`}
              type="button"
              role="listitem"
              className="wb-search-hit"
              onClick={() => onOpenFile(h.path, h.name)}
            >
              <span className="wb-search-hit-path">
                {h.path}:{h.line}
              </span>
              <span className="wb-search-hit-preview">{h.preview}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
