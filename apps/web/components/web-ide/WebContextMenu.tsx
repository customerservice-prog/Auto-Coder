'use client';

import { useEffect, useRef } from 'react';

export interface ContextMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  onSelect: () => void;
}

interface WebContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function WebContextMenu({ open, x, y, items, onClose }: WebContextMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDoc, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const el = panelRef.current;
    const rect = el.getBoundingClientRect();
    let nx = x;
    let ny = y;
    if (nx + rect.width > window.innerWidth - 4) nx = window.innerWidth - rect.width - 4;
    if (ny + rect.height > window.innerHeight - 4) ny = window.innerHeight - rect.height - 4;
    el.style.left = `${Math.max(4, nx)}px`;
    el.style.top = `${Math.max(4, ny)}px`;
  }, [open, x, y]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="wb-ctx-menu"
      role="menu"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="menuitem"
          className="wb-ctx-item"
          disabled={it.disabled}
          onClick={() => {
            if (!it.disabled) {
              it.onSelect();
              onClose();
            }
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
