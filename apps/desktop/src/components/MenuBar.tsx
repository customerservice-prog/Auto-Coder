import { useState, useEffect, useRef, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { APP_MENUS, type MenuAction, type MenuLeaf } from '../menu-config';
import { isAppShortcutSuppressed } from '../shortcut-context';

function isSeparator(item: MenuLeaf): item is { separator: true } {
  return 'separator' in item && item.separator === true;
}

function formatAccel(accelerator?: string): string {
  if (!accelerator) return '';
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)) {
    return accelerator
      .replace(/Ctrl\+/g, '⌘')
      .replace(/Alt\+/g, '⌥')
      .replace(/Shift\+/g, '⇧');
  }
  return accelerator;
}

function enabledMenuItems(panel: HTMLElement): HTMLButtonElement[] {
  return [...panel.querySelectorAll<HTMLButtonElement>('button.menu-bar-item:not(:disabled)')];
}

/** Sequential focus navigation participants, in document tree order. */
function tabbableInDocumentOrder(doc: Document): HTMLElement[] {
  const sel =
    'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]';
  return Array.from(doc.querySelectorAll<HTMLElement>(sel)).filter((el) => {
    if (el.tabIndex < 0) return false;
    if (!el.getClientRects().length) return false;
    return true;
  });
}

/** APG: Tab from an open menu moves focus past the menubar subtree. */
function firstFocusableAfterMenubar(bar: HTMLElement, doc: Document): HTMLElement | null {
  for (const el of tabbableInDocumentOrder(doc)) {
    if (bar.contains(el)) continue;
    if (bar.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) return el;
  }
  return null;
}

function lastFocusableBeforeMenubar(bar: HTMLElement, doc: Document): HTMLElement | null {
  let last: HTMLElement | null = null;
  for (const el of tabbableInDocumentOrder(doc)) {
    if (bar.contains(el)) continue;
    if (bar.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) last = el;
  }
  return last;
}

function focusMenuListKey(
  e: ReactKeyboardEvent<HTMLDivElement>,
  panel: HTMLDivElement
): boolean {
  const key = e.key;
  if (key !== 'ArrowDown' && key !== 'ArrowUp' && key !== 'Home' && key !== 'End') return false;
  const items = enabledMenuItems(panel);
  if (!items.length) return false;
  e.preventDefault();
  const cur = items.indexOf(document.activeElement as HTMLButtonElement);
  if (key === 'Home') {
    items[0]?.focus();
    return true;
  }
  if (key === 'End') {
    items[items.length - 1]?.focus();
    return true;
  }
  if (key === 'ArrowDown') {
    const next = cur < 0 ? 0 : (cur + 1) % items.length;
    items[next]?.focus();
    return true;
  }
  const next = cur < 0 ? items.length - 1 : (cur - 1 + items.length) % items.length;
  items[next]?.focus();
  return true;
}

/** First-letter navigation inside an open menu (cycles when the same letter is pressed). */
function focusMenuTypeahead(
  e: ReactKeyboardEvent<HTMLDivElement>,
  panel: HTMLDivElement
): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const key = e.key;
  if (key.length !== 1) return false;
  const ch = key.toLowerCase();
  if (!/[a-z0-9]/.test(ch)) return false;

  const items = enabledMenuItems(panel);
  if (!items.length) return false;

  const labels = items.map(
    (btn) => (btn.querySelector('.menu-bar-item-label')?.textContent ?? '').trim().toLowerCase()
  );
  const cur = items.indexOf(document.activeElement as HTMLButtonElement);
  const start = cur < 0 ? 0 : (cur + 1) % items.length;

  for (let o = 0; o < items.length; o++) {
    const idx = (start + o) % items.length;
    if (labels[idx]!.startsWith(ch)) {
      e.preventDefault();
      items[idx]?.focus();
      return true;
    }
  }
  return false;
}

interface MenuBarProps {
  onAction: (action: MenuAction) => void;
  /** Dynamic disable (e.g. Close Editor when no tab is active). */
  actionDisabled?: (action: MenuAction) => boolean;
}

export function MenuBar({ onAction, actionDisabled }: MenuBarProps) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  /** Roving tabindex: one top-level `menuitem` is in tab order (APG menubar). */
  const [menubarTabStopIdx, setMenubarTabStopIdx] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  const moveFocusOutOfOpenMenu = useCallback((forward: boolean) => {
    setOpenLabel(null);
    requestAnimationFrame(() => {
      const bar = barRef.current;
      if (!bar) return;
      const next = forward
        ? firstFocusableAfterMenubar(bar, document)
        : lastFocusableBeforeMenubar(bar, document);
      next?.focus();
    });
  }, []);

  /** Windows / Linux pattern: F10 focuses the menu bar (Shift+F10 reserved for context menus). */
  useEffect(() => {
    const onDoc = (e: KeyboardEvent) => {
      if (e.key !== 'F10' || e.shiftKey) return;
      if (isAppShortcutSuppressed(e.target)) return;
      e.preventDefault();
      setOpenLabel(null);
      setMenubarTabStopIdx(0);
      requestAnimationFrame(() => {
        barRef.current?.querySelector<HTMLButtonElement>('button.menu-bar-label')?.focus();
      });
    };
    document.addEventListener('keydown', onDoc, true);
    return () => document.removeEventListener('keydown', onDoc, true);
  }, []);

  useEffect(() => {
    if (!openLabel) return;
    const close = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Node) || !barRef.current?.contains(t)) {
        setOpenLabel(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openLabel]);

  useEffect(() => {
    if (!openLabel) return;
    const menuIdx = APP_MENUS.findIndex((m) => m.label === openLabel);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setOpenLabel(null);
      if (menuIdx >= 0) {
        requestAnimationFrame(() => {
          barRef.current
            ?.querySelector<HTMLButtonElement>(
              `button.menu-bar-label[aria-controls="autocoder-menu-${menuIdx}"]`
            )
            ?.focus();
        });
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [openLabel]);

  /** Keep the roving tab stop on the menu whose dropdown is open (arrow keys move menus without focusing labels). */
  useEffect(() => {
    if (!openLabel) return;
    const idx = APP_MENUS.findIndex((m) => m.label === openLabel);
    if (idx >= 0) setMenubarTabStopIdx(idx);
  }, [openLabel]);

  /** After the open panel mounts, move focus to the first enabled item (incl. horizontal menu switching). */
  useEffect(() => {
    if (!openLabel) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const first = barRef.current?.querySelector<HTMLButtonElement>(
          '.menu-bar-top:has(.menu-bar-dropdown) button.menu-bar-item:not(:disabled)'
        );
        first?.focus();
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [openLabel]);

  const run = (item: MenuLeaf) => {
    if (isSeparator(item) || item.disabled || actionDisabled?.(item.action)) return;
    setOpenLabel(null);
    onAction(item.action);
  };

  return (
    <div className="menu-bar" ref={barRef} role="menubar" aria-label="Application menu">
      {APP_MENUS.map((top, menuIdx) => {
        const menuPanelId = `autocoder-menu-${menuIdx}`;
        const isOpen = openLabel === top.label;
        return (
        <div key={top.label} className="menu-bar-top">
          <button
            type="button"
            role="menuitem"
            tabIndex={menuIdx === menubarTabStopIdx ? 0 : -1}
            className={`menu-bar-label ${isOpen ? 'open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={isOpen}
            aria-controls={menuPanelId}
            onClick={(e) => {
              e.stopPropagation();
              setOpenLabel((v) => (v === top.label ? null : top.label));
            }}
            onFocus={() => setMenubarTabStopIdx(menuIdx)}
            onMouseEnter={() => {
              if (openLabel) setOpenLabel(top.label);
            }}
            onKeyDown={(e) => {
              const k = e.key;
              const bar = barRef.current;
              if (isOpen && k === 'Tab') {
                e.preventDefault();
                moveFocusOutOfOpenMenu(!e.shiftKey);
                return;
              }
              if (!isOpen && bar && (k === 'Home' || k === 'End')) {
                e.preventDefault();
                const labels = [...bar.querySelectorAll<HTMLButtonElement>('button.menu-bar-label')];
                if (!labels.length) return;
                const next = k === 'Home' ? 0 : labels.length - 1;
                setMenubarTabStopIdx(next);
                labels[next]?.focus();
                return;
              }
              if (!isOpen && bar && (k === 'ArrowLeft' || k === 'ArrowRight')) {
                e.preventDefault();
                const labels = [...bar.querySelectorAll<HTMLButtonElement>('button.menu-bar-label')];
                const i = labels.indexOf(e.currentTarget as HTMLButtonElement);
                if (i < 0) return;
                const delta = k === 'ArrowRight' ? 1 : -1;
                const next = (i + delta + labels.length) % labels.length;
                setMenubarTabStopIdx(next);
                labels[next]?.focus();
                return;
              }
              if (k === 'Enter' || k === ' ') {
                e.preventDefault();
                if (isOpen) {
                  const panel = barRef.current?.querySelector(`#${menuPanelId}`);
                  if (panel instanceof HTMLElement) enabledMenuItems(panel)[0]?.focus();
                } else {
                  setOpenLabel(top.label);
                }
                return;
              }
              if (k === 'ArrowDown') {
                e.preventDefault();
                if (!isOpen) setOpenLabel(top.label);
                requestAnimationFrame(() => {
                  const panel = barRef.current?.querySelector(`#${menuPanelId}`);
                  if (panel instanceof HTMLElement) enabledMenuItems(panel)[0]?.focus();
                });
              }
            }}
          >
            {top.label}
          </button>
          {isOpen && (
            <div
              className="menu-bar-dropdown"
              id={menuPanelId}
              role="menu"
              aria-orientation="vertical"
              onKeyDown={(e) => {
                if (!(e.currentTarget instanceof HTMLDivElement)) return;
                const panel = e.currentTarget;
                const k = e.key;
                if (k === 'Tab') {
                  e.preventDefault();
                  moveFocusOutOfOpenMenu(!e.shiftKey);
                  return;
                }
                if (k === 'ArrowLeft' || k === 'ArrowRight') {
                  e.preventDefault();
                  if (k === 'ArrowLeft') {
                    if (menuIdx === 0) {
                      setOpenLabel(null);
                      requestAnimationFrame(() => {
                        barRef.current
                          ?.querySelector<HTMLButtonElement>(
                            'button.menu-bar-label[aria-controls="autocoder-menu-0"]'
                          )
                          ?.focus();
                      });
                    } else {
                      setOpenLabel(APP_MENUS[menuIdx - 1]!.label);
                    }
                    return;
                  }
                  setOpenLabel(APP_MENUS[(menuIdx + 1) % APP_MENUS.length]!.label);
                  return;
                }
                if (focusMenuTypeahead(e, panel)) return;
                focusMenuListKey(e, panel);
              }}
            >
              {top.items.map((item, i) =>
                isSeparator(item) ? (
                  <div key={i} className="menu-bar-sep" role="separator" />
                ) : (
                  <button
                    key={i}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    className="menu-bar-item"
                    disabled={Boolean(item.disabled || actionDisabled?.(item.action))}
                    onClick={() => run(item)}
                  >
                    <span className="menu-bar-item-label">{item.label}</span>
                    {item.accelerator ? (
                      <span className="menu-bar-item-accel">{formatAccel(item.accelerator)}</span>
                    ) : null}
                  </button>
                )
              )}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}
