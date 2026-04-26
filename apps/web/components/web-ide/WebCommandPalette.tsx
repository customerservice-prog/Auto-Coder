'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface PaletteItem {
  id: string;
  label: string;
  detail?: string;
  shortcut?: string;
  onSelect: () => void;
}

interface WebCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: PaletteItem[];
}

export function WebCommandPalette({ open, onClose, items }: WebCommandPaletteProps) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(s) ||
        (it.detail && it.detail.toLowerCase().includes(s)) ||
        it.id.toLowerCase().includes(s),
    );
  }, [items, q]);

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
    const it = filtered[idx];
    if (it) {
      it.onSelect();
      onClose();
    }
  }, [filtered, idx, onClose]);

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
    <div className="wb-palette-overlay" role="dialog" aria-modal="true" aria-label="Command palette">
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
          placeholder="Run a command…"
          autoComplete="off"
          spellCheck={false}
        />
        <ul className="wb-palette-list" role="listbox" aria-label="Commands">
          {filtered.length === 0 ? (
            <li className="wb-palette-empty">No matching commands</li>
          ) : (
            filtered.map((it, i) => (
              <li key={it.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={i === idx}
                  className={`wb-palette-item ${i === idx ? 'wb-palette-item-active' : ''}`}
                  onClick={() => {
                    setIdx(i);
                    it.onSelect();
                    onClose();
                  }}
                  onMouseEnter={() => setIdx(i)}
                >
                  <span className="wb-palette-label">{it.label}</span>
                  {it.shortcut ? <kbd className="wb-palette-kbd">{it.shortcut}</kbd> : null}
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="wb-palette-hint">↑↓ navigate · ↵ run · esc close</p>
      </div>
    </div>
  );
}
