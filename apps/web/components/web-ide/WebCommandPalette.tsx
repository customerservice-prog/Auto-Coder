'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sortByFuzzy } from '@/components/web-ide/workbench-fuzzy';

export interface PaletteItem {
  id: string;
  label: string;
  detail?: string;
  shortcut?: string;
  /** Group label shown as a sticky row above items */
  section?: string;
  onSelect: () => void;
}

interface WebCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  items: PaletteItem[];
  /** Command ids most recently run (first = most recent) */
  recentIds?: string[];
  /** Fires after a command runs (for persistence / MRU) */
  onAfterRun?: (id: string) => void;
}

export function WebCommandPalette({ open, onClose, items, recentIds = [], onAfterRun }: WebCommandPaletteProps) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const s = q.trim();
    if (!s) {
      const seen = new Set<string>();
      const recent: PaletteItem[] = [];
      for (const id of recentIds) {
        const it = items.find((x) => x.id === id);
        if (it && !seen.has(it.id)) {
          seen.add(it.id);
          recent.push(it);
        }
      }
      const rest = items.filter((it) => !seen.has(it.id));
      return [...recent, ...rest];
    }
    const hay = (it: PaletteItem) => `${it.label} ${it.detail ?? ''} ${it.id}`;
    const scored = sortByFuzzy(s, items, hay);
    if (scored.length > 0) return scored;
    const low = s.toLowerCase();
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(low) ||
        (it.detail && it.detail.toLowerCase().includes(low)) ||
        it.id.toLowerCase().includes(low),
    );
  }, [items, q, recentIds]);

  const flatIndex = useMemo(() => {
    const sections: { title: string; items: PaletteItem[] }[] = [];
    for (const it of filtered) {
      const title = it.section ?? 'Commands';
      const last = sections[sections.length - 1];
      if (last && last.title === title) last.items.push(it);
      else sections.push({ title, items: [it] });
    }
    return sections;
  }, [filtered]);

  const flatList = useMemo(() => flatIndex.flatMap((s) => s.items), [flatIndex]);

  useEffect(() => {
    setIdx(0);
  }, [q, open, flatList.length]);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setIdx(0);
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const run = useCallback(() => {
    const it = flatList[idx];
    if (it) {
      it.onSelect();
      onAfterRun?.(it.id);
      onClose();
    }
  }, [flatList, idx, onClose, onAfterRun]);

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
              setIdx((i) => Math.min(Math.max(0, flatList.length - 1), i + 1));
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
          {flatList.length === 0 ? (
            <li className="wb-palette-empty">No matching commands</li>
          ) : (
            flatIndex.flatMap((sec) => [
              <li key={`h-${sec.title}`} className="wb-palette-section" role="presentation">
                {sec.title}
              </li>,
              ...sec.items.map((it) => {
                const i = flatList.indexOf(it);
                return (
                  <li key={it.id} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === idx}
                      className={`wb-palette-item ${i === idx ? 'wb-palette-item-active' : ''}`}
                      onClick={() => {
                        setIdx(i);
                        it.onSelect();
                        onAfterRun?.(it.id);
                        onClose();
                      }}
                      onMouseEnter={() => setIdx(i)}
                    >
                      <span className="wb-palette-label">{it.label}</span>
                      {it.shortcut ? <kbd className="wb-palette-kbd">{it.shortcut}</kbd> : null}
                    </button>
                  </li>
                );
              }),
            ])
          )}
        </ul>
      </div>
    </div>
  );
}
