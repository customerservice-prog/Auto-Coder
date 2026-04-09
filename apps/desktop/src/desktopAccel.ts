/** Matches MenuBar Mac detection so hints align with displayed menu accelerators. */
export function isMacLike(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform ?? '');
}

export type DesktopAccelKey =
  | 'openFolder'
  | 'openFile'
  | 'newFile'
  | 'find'
  | 'toggleExplorer'
  | 'toggleSearch'
  | 'toggleTerminal'
  | 'toggleChat'
  | 'togglePrimarySidebar';

/** Human-readable shortcuts; mirrors APP_MENUS entries in menu-config.ts. */
export function desktopAccel(shortcut: DesktopAccelKey): string {
  const mac = isMacLike();
  if (shortcut === 'openFolder') return mac ? '⌘⌥O' : 'Ctrl+Alt+O';
  if (shortcut === 'openFile') return mac ? '⌘O' : 'Ctrl+O';
  if (shortcut === 'find') return mac ? '⌘F' : 'Ctrl+F';
  if (shortcut === 'toggleExplorer') return mac ? '⌘⇧E' : 'Ctrl+Shift+E';
  if (shortcut === 'toggleSearch') return mac ? '⌘⇧F' : 'Ctrl+Shift+F';
  if (shortcut === 'toggleTerminal') return mac ? '⌘`' : 'Ctrl+`';
  if (shortcut === 'toggleChat') return mac ? '⌘L' : 'Ctrl+L';
  if (shortcut === 'togglePrimarySidebar') return mac ? '⌘B' : 'Ctrl+B';
  return mac ? '⌘N' : 'Ctrl+N';
}
