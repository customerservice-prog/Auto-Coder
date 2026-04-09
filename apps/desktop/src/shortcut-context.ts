/** Focus is inside a Monaco overlay where the editor should keep keyboard priority. */
function targetInMonacoIdeOverlay(el: Element): boolean {
  return Boolean(
    el.closest('.quick-input-widget') ||
      el.closest('.find-widget') ||
      el.closest('.suggest-widget') ||
      el.closest('.parameter-hints-widget') ||
      el.closest('.rename-box') ||
      el.closest('.peekview-widget') ||
      el.closest('.monaco-hover') ||
      el.closest('.monaco-menu')
  );
}

/**
 * Targets where global IDE shortcuts should not run: chat, terminal, and Monaco overlays
 * (find/replace, quick input, suggestions, etc.) so those UIs keep keyboard priority.
 */
export function isAppShortcutSuppressed(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  if (
    target.closest('.chat-input-area') ||
    target.closest('.terminal-panel') ||
    target.closest('.terminal-container')
  ) {
    return true;
  }
  return targetInMonacoIdeOverlay(target);
}

/**
 * Same predicate as {@link isAppShortcutSuppressed}; use at call sites that only care about
 * quit / reload for readability.
 */
export function isQuitOrReloadShortcutSuppressed(target: EventTarget | null): boolean {
  return isAppShortcutSuppressed(target);
}
