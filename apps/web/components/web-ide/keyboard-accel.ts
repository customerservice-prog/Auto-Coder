/** VS Code-style shortcut label for status UI (⌘ on macOS). */
export function formatModShortcut(label: string): string {
  if (typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)) {
    return label.replaceAll('Ctrl', '⌘');
  }
  return label;
}
