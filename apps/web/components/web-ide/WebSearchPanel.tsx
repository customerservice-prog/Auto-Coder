'use client';

import { useMemo, useState } from 'react';
import { scanWorkspaceFiles, type SearchHit } from '@/components/web-ide/web-search-scan';

export type { SearchHit };

interface WebSearchPanelProps {
  /** Paths → display name + current buffer text (demo + open editors). */
  files: Record<string, { name: string; content: string }>;
  onOpenFile: (path: string, name: string) => void;
}

function splitIncludePatterns(raw: string): string[] {
  return raw
    .split(/[,;\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function WebSearchPanel({ files, onOpenFile }: WebSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [replace, setReplace] = useState('');
  const [includePaths, setIncludePaths] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const pathFragments = useMemo(() => splitIncludePatterns(includePaths), [includePaths]);
  const results = useMemo(
    () => scanWorkspaceFiles(files, query, caseSensitive, wholeWord, pathFragments),
    [files, query, caseSensitive, wholeWord, pathFragments],
  );

  const fileCount = Object.keys(files).length;

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
        <input
          className="wb-search-input wb-search-files-include"
          placeholder="Files to include (e.g. tsx, dashboard — comma-separated)"
          value={includePaths}
          onChange={(e) => setIncludePaths(e.target.value)}
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
      <p className="wb-search-scope">
        {fileCount} file{fileCount === 1 ? '' : 's'} (demo tree + open buffers, including unsaved edits).
      </p>
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
