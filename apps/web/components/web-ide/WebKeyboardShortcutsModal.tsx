'use client';

import { useEffect } from 'react';
import { formatModShortcut } from '@/components/web-ide/keyboard-accel';

interface WebKeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const ROWS: { keys: string; desc: string }[] = [
  { keys: 'Ctrl+Shift+P', desc: 'Command palette' },
  { keys: 'F1', desc: 'Command palette' },
  { keys: 'Ctrl+P', desc: 'Quick open (go to file)' },
  { keys: 'Ctrl+G', desc: 'Go to line (or line:column) when the editor is focused' },
  { keys: 'Ctrl+F', desc: 'Find in current file (Monaco find widget)' },
  { keys: 'Ctrl+H', desc: 'Replace in current file (find + replace widget)' },
  { keys: 'Ctrl+Shift+F', desc: 'Open Search in the side bar' },
  { keys: 'Ctrl+Shift+/', desc: 'This shortcuts list' },
  { keys: 'Ctrl+Alt+Z', desc: 'Toggle zen mode (hide chrome)' },
  { keys: 'Ctrl+PageDown', desc: 'Next editor tab' },
  { keys: 'Ctrl+PageUp', desc: 'Previous editor tab' },
  { keys: 'Ctrl+1 … Ctrl+9', desc: 'Focus editor tab 1–9 (when open)' },
  { keys: 'Ctrl+= / Ctrl+-', desc: 'Editor font zoom in / out' },
  { keys: 'Ctrl+0', desc: 'Reset editor font zoom' },
  { keys: 'Ctrl+Alt+M', desc: 'Toggle editor minimap' },
  { keys: 'Ctrl+B', desc: 'Toggle primary side bar' },
  { keys: 'Ctrl+`', desc: 'Toggle bottom panel' },
  {
    keys: 'Esc',
    desc: 'Close palette / quick open / go to line / this dialog; exit zen when chrome is hidden',
  },
];

export function WebKeyboardShortcutsModal({ open, onClose }: WebKeyboardShortcutsModalProps) {
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
    <div className="wb-palette-overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <button type="button" className="wb-palette-backdrop" aria-label="Close" onClick={onClose} />
      <div className="wb-shortcuts-panel">
        <div className="wb-shortcuts-head">
          <h2 className="wb-shortcuts-title">Keyboard shortcuts</h2>
          <button type="button" className="wb-shortcuts-close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="wb-shortcuts-lead">Web IDE — same muscle memory as VS Code / Cursor (where applicable).</p>
        <div className="wb-shortcuts-scroll">
          <table className="wb-shortcuts-table">
            <thead>
              <tr>
                <th scope="col">Shortcut</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.keys}>
                  <td>
                    <kbd className="wb-shortcuts-kbd">{formatModShortcut(row.keys)}</kbd>
                  </td>
                  <td>{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="wb-shortcuts-foot">Tip: run more actions from the command palette.</p>
      </div>
    </div>
  );
}
