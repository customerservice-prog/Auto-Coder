'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sortByFuzzy } from '@/components/web-ide/workbench-fuzzy';

export interface QuickOpenEntry {
  path: string;
  name: string;
}

interface WebQuickOpenProps {
  open: boolean;
  onClose: () => void;
  entries: QuickOpenEntry[];
  onPick: (path: string, name: string, opts?: { openInNewTab?: boolean }) => void;
}

export function WebQuickOpen({ open, onClose, entries, onPick }: WebQuickOpenProps) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const s = q.trim();
    if (!s) return entries;
    const hay = (e: QuickOpenEntry) => `${e.name} ${e.path}`;
    const scored = sortByFuzzy(s, entries, hay);
    if (scored.length > 0) return scored;
    const low = s.toLowerCase();
    return entries.filter((e) => e.name.toLowerCase().includes(low) || e.path.toLowerCase().includes(low));
  }, [entries, q]);

  useEffect(() => {
    setIdx(0);
  }, [q, open]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setIdx(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const run = useCallback(() => {
    const row = filtered[idx];
    if (row) {
      onPick(row.path, row.name, undefined);
      onClose();
    }
  }, [filtered, idx, onPick, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="wb-palette-overlay" role="dialog" aria-modal="true" aria-label="Quick open">
      <button type="button" className="wb-palette-backdrop" aria-label="Close" onClick={onClose} />
      <div className="wb-palette-panel">
        <input
          ref={inputRef}
          className="wb-palette-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIdx((i) => Math.min(Math.max(0, filtered.length - 1), i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIdx((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run();
            }
          }}
          placeholder="Go to file…"
          autoComplete="off"
          spellCheck={false}
        />
        <ul className="wb-palette-list" role="listbox" aria-label="Files">
          {filtered.length === 0 ? (
            <li className="wb-palette-empty">No matching files</li>
          ) : (
            filtered.map((row, i) => (
              <li key={row.path} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={i === idx}
                  className={`wb-palette-item ${i === idx ? 'wb-palette-item-active' : ''}`}
                  onClick={(ev) => {
                    setIdx(i);
                    if (ev.ctrlKey || ev.metaKey) {
                      ev.preventDefault();
                      onPick(row.path, row.name, { openInNewTab: true });
                    } else {
                      onPick(row.path, row.name);
                    }
                    onClose();
                  }}
                  onAuxClick={(ev) => {
                    if (ev.button === 1) {
                      ev.preventDefault();
                      setIdx(i);
                      onPick(row.path, row.name, { openInNewTab: true });
                      onClose();
                    }
                  }}
                  onMouseEnter={() => setIdx(i)}
                >
                  <span className="wb-palette-label">{row.name}</span>
                  <span className="wb-quick-path">{row.path}</span>
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="wb-palette-hint">↑↓ navigate · ↵ open · esc close</p>
      </div>
    </div>
  );
}
