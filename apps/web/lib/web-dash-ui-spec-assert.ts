/**
 * Dev-only UI dimension checks for the Cursor-clone workbench.
 * Logs `[UI MISMATCH] …` when measured layout violates locked spec.
 */

const PREFIX = '[UI MISMATCH]';

function warn(msg: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.warn(msg);
  }
}

function mismatch(expected: string, got: string): void {
  warn(`${PREFIX} expected ${expected} got ${got}`);
}

function approx(n: number, target: number, tol = 1): boolean {
  return Math.abs(n - target) <= tol;
}

/** Measure workbench chrome inside `.web-dash-root` (pass `wbApp` root). */
export function runWorkbenchLayoutAssertions(wbApp: HTMLElement | null): void {
  if (process.env.NODE_ENV !== 'development' || !wbApp) {
    return;
  }

  const root = wbApp.closest('.web-dash-root');
  if (!root) return;

  const activity = root.querySelector<HTMLElement>('.wb-activity-bar.activity-bar');
  if (activity) {
    const w = activity.getBoundingClientRect().width;
    if (!approx(w, 44, 0.5)) mismatch('activity bar width 44px', `${w.toFixed(1)}px`);
  }

  const sidebar = root.querySelector<HTMLElement>('.wb-sidebar');
  if (sidebar) {
    const w = sidebar.getBoundingClientRect().width;
    if (w > 240.5) mismatch('explorer width ≤240px', `${w.toFixed(1)}px`);
  }

  const composer = root.querySelector<HTMLElement>('aside.wb-composer.composer');
  if (composer) {
    const w = composer.getBoundingClientRect().width;
    if (w < 299.5 || w > 320.5) {
      mismatch('composer width 300–320px', `${w.toFixed(1)}px`);
    }
  }

  const topbar = root.querySelector<HTMLElement>('header.ide-titlebar.wb-chrome.topbar');
  if (topbar) {
    const h = topbar.getBoundingClientRect().height;
    if (!approx(h, 28, 0.5)) mismatch('topbar height 28px', `${h.toFixed(1)}px`);
  }

  const status = root.querySelector<HTMLElement>('footer.wb-status-bar.statusbar');
  if (status) {
    const h = status.getBoundingClientRect().height;
    if (!approx(h, 21, 0.5)) mismatch('statusbar height 21px', `${h.toFixed(1)}px`);
  }

  const explorerRow = root.querySelector<HTMLElement>('.wb-sidebar.explorer .explorer-row');
  if (explorerRow) {
    const h = explorerRow.getBoundingClientRect().height;
    if (!approx(h, 20, 0.5)) mismatch('explorer row height 20px', `${h.toFixed(1)}px`);
  }

  const tabBar = root.querySelector<HTMLElement>('.wb-tab-bar');
  if (tabBar) {
    const h = tabBar.getBoundingClientRect().height;
    if (h > 30.5) mismatch('tab bar height ≤30px', `${h.toFixed(1)}px`);
  }

  const bottomTabs = root.querySelector<HTMLElement>('.wb-bottom-tabs.bottom-tabs');
  if (bottomTabs) {
    const h = bottomTabs.getBoundingClientRect().height;
    if (!approx(h, 24, 0.5)) mismatch('bottom panel tab row height 24px', `${h.toFixed(1)}px`);
  }
}

const COMPOSER_VIOLATION = '[ComposerViolation] Form structure detected — must be stream-based';

/** DOM structure checks for the agent composer (pass `.composer-shell` element). */
export function runComposerStructureAssertions(shell: HTMLElement | null): void {
  if (process.env.NODE_ENV !== 'development' || !shell) {
    return;
  }

  const textareas = shell.querySelectorAll('textarea');
  if (textareas.length > 1) {
    console.warn(`${COMPOSER_VIOLATION} (${textareas.length} textareas)`);
  }

  if (shell.querySelector('label')) {
    console.warn(`${COMPOSER_VIOLATION} (<label> present)`);
  }

  const badTitles = shell.querySelectorAll('h1, h2, h3, legend');
  if (badTitles.length > 0) {
    console.warn(`${COMPOSER_VIOLATION} (heading/legend present)`);
  }

  const stream = shell.querySelector<HTMLElement>('.composer-stream');
  const inputbar = shell.querySelector<HTMLElement>('.composer-inputbar');
  if (stream && inputbar) {
    const shellH = shell.getBoundingClientRect().height;
    const streamH = stream.getBoundingClientRect().height;
    if (shellH > 40 && streamH / shellH < 0.7) {
      console.warn(
        `${COMPOSER_VIOLATION} .composer-stream height ${(100 * (streamH / shellH)).toFixed(0)}% of shell (need >70%)`,
      );
    }

    const ih = inputbar.getBoundingClientRect().height;
    if (ih > 34.5) {
      console.warn(`${COMPOSER_VIOLATION} .composer-inputbar height ${ih.toFixed(1)}px (max 34px base)`);
    }
  }
}
