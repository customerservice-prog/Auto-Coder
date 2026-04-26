'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface QuickOpenEntry {
  path: string;
  name: string;
}

interface WebQuickOpenProps {
  open: boolean;
  onClose: () => void;
  entries: QuickOpenEntry[];
  onPick: (path: string, name: string) => void;
}

export function WebQuickOpen({ open, onClose, entries, onPick }: WebQuickOpenProps) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return entries;
    return entries.filter(
      (e) => e.name.toLowerCase().includes(s) || e.path.toLowerCase().includes(s),
    );
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
      onPick(row.path, row.name);
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
                  onClick={() => {
                    setIdx(i);
                    onPick(row.path, row.name);
                    onClose();
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
