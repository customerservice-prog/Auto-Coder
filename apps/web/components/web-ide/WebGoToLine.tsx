'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface WebGoToLineProps {
  open: boolean;
  onClose: () => void;
  defaultLine: number;
  defaultColumn: number;
  onSubmit: (line: number, column: number) => void;
}

export function WebGoToLine({ open, onClose, defaultLine, defaultColumn, onSubmit }: WebGoToLineProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setValue(defaultColumn > 1 ? `${defaultLine}:${defaultColumn}` : String(defaultLine));
    const id = requestAnimationFrame(() => {
      const el = inputRef.current;
      el?.focus();
      el?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [open, defaultLine, defaultColumn]);

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

  const run = useCallback(() => {
    const trimmed = value.trim();
    const both = /^(\d+)\s*:\s*(\d+)$/.exec(trimmed);
    const one = /^(\d+)$/.exec(trimmed);
    let line = 1;
    let col = 1;
    if (both) {
      line = parseInt(both[1]!, 10);
      col = parseInt(both[2]!, 10);
    } else if (one) {
      line = parseInt(one[1]!, 10);
      col = 1;
    } else {
      onClose();
      return;
    }
    if (!Number.isFinite(line) || line < 1 || !Number.isFinite(col) || col < 1) {
      onClose();
      return;
    }
    onSubmit(line, col);
    onClose();
  }, [value, onSubmit, onClose]);

  if (!open) return null;

  return (
    <div className="wb-palette-overlay" role="dialog" aria-modal="true" aria-label="Go to line">
      <button type="button" className="wb-palette-backdrop" aria-label="Close" onClick={onClose} />
      <div className="wb-palette-panel wb-go-to-line-panel">
        <label className="wb-go-to-line-label" htmlFor="wb-go-to-line-input">
          Go to line
        </label>
        <input
          id="wb-go-to-line-input"
          ref={inputRef}
          className="wb-palette-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              run();
            }
          }}
          placeholder="42 or 42:10"
          autoComplete="off"
          spellCheck={false}
        />
        <p className="wb-go-to-line-hint">Line number, or line:column · Enter to go · Esc to close</p>
      </div>
    </div>
  );
}
