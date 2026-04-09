/**
 * Cursor / VS Code–style menu labels (accelerators shown; wiring varies by platform).
 */

export type MenuAction =
  | 'newTextFile'
  | 'newWindow'
  | 'openFile'
  | 'openFolder'
  | 'refreshExplorer'
  | 'revealInFolder'
  | 'copyActiveFilePath'
  | 'save'
  | 'saveAs'
  | 'saveAll'
  | 'closeEditor'
  | 'closeAllEditors'
  | 'closeWindow'
  | 'quit'
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'find'
  | 'replace'
  | 'findInFiles'
  | 'toggleLineComment'
  | 'toggleBlockComment'
  | 'selectAll'
  | 'expandSelection'
  | 'shrinkSelection'
  | 'copyLineUp'
  | 'copyLineDown'
  | 'moveLineUp'
  | 'moveLineDown'
  | 'addCursorAbove'
  | 'addCursorBelow'
  | 'addNextOccurrence'
  | 'commandPalette'
  | 'openView'
  | 'toggleExplorer'
  | 'togglePrimarySidebar'
  | 'toggleSearch'
  | 'toggleScm'
  | 'toggleRun'
  | 'toggleExtensions'
  | 'toggleProblems'
  | 'toggleOutput'
  | 'toggleDebugConsole'
  | 'toggleTerminalPanel'
  | 'toggleChat'
  | 'toggleWordWrap'
  | 'zoomIn'
  | 'zoomOut'
  | 'resetZoom'
  | 'goToFile'
  | 'goToSymbolWorkspace'
  | 'goToSymbolEditor'
  | 'goToLine'
  | 'startDebugging'
  | 'runWithoutDebugging'
  | 'stopDebugging'
  | 'toggleBreakpoint'
  | 'newTerminal'
  | 'showCommands'
  | 'toggleDevTools'
  | 'reloadWindow'
  | 'openSignIn'
  | 'about'
  | 'noop';

/** Routed to Monaco — disable in the menu when no document tab is open. */
export const MENU_ACTIONS_NEEDING_ACTIVE_EDITOR: ReadonlySet<MenuAction> = new Set([
  'undo',
  'redo',
  'cut',
  'copy',
  'paste',
  'find',
  'replace',
  'toggleLineComment',
  'toggleBlockComment',
  'selectAll',
  'expandSelection',
  'shrinkSelection',
  'copyLineUp',
  'copyLineDown',
  'moveLineUp',
  'moveLineDown',
  'addCursorAbove',
  'addCursorBelow',
  'addNextOccurrence',
  'toggleWordWrap',
  'zoomIn',
  'zoomOut',
  'resetZoom',
  'goToLine',
  'goToSymbolEditor',
]);

export type MenuLeaf =
  | { separator: true }
  | {
      separator?: false;
      label: string;
      accelerator?: string;
      action: MenuAction;
      disabled?: boolean;
    };

export interface MenuSection {
  label: string;
  items: MenuLeaf[];
}

export const APP_MENUS: MenuSection[] = [
  {
    label: 'File',
    items: [
      { label: 'New Text File', accelerator: 'Ctrl+N', action: 'newTextFile' },
      { label: 'New Agents Window', accelerator: 'Ctrl+Shift+N', action: 'noop', disabled: true },
      { separator: true },
      { label: 'Open File…', accelerator: 'Ctrl+O', action: 'openFile' },
      { label: 'Open Folder…', accelerator: 'Ctrl+Alt+O', action: 'openFolder' },
      { label: 'Refresh Explorer', action: 'refreshExplorer' },
      { label: 'Reveal in Folder', action: 'revealInFolder' },
      { label: 'Copy Path of Active File', action: 'copyActiveFilePath' },
      { separator: true },
      { label: 'Save', accelerator: 'Ctrl+S', action: 'save' },
      { label: 'Save As…', accelerator: 'Ctrl+Shift+S', action: 'saveAs' },
      { label: 'Save All', accelerator: 'Ctrl+Alt+S', action: 'saveAll' },
      { separator: true },
      { label: 'Close Editor', accelerator: 'Ctrl+W', action: 'closeEditor' },
      { label: 'Close All Editors', action: 'closeAllEditors' },
      { label: 'Close Window', accelerator: 'Alt+F4', action: 'closeWindow' },
      { separator: true },
      { label: 'Exit', accelerator: 'Ctrl+Q', action: 'quit' },
    ],
  },
  {
    label: 'Edit',
    items: [
      { label: 'Undo', accelerator: 'Ctrl+Z', action: 'undo' },
      { label: 'Redo', accelerator: 'Ctrl+Y', action: 'redo' },
      { separator: true },
      { label: 'Cut', accelerator: 'Ctrl+X', action: 'cut' },
      { label: 'Copy', accelerator: 'Ctrl+C', action: 'copy' },
      { label: 'Paste', accelerator: 'Ctrl+V', action: 'paste' },
      { separator: true },
      { label: 'Find', accelerator: 'Ctrl+F', action: 'find' },
      { label: 'Replace', accelerator: 'Ctrl+H', action: 'replace' },
      /* Accelerator omitted: same chord as View → Search (sidebar); reserved for workspace search when shipped. */
      { label: 'Find in Files', action: 'findInFiles', disabled: true },
      { separator: true },
      { label: 'Toggle Line Comment', accelerator: 'Ctrl+/', action: 'toggleLineComment' },
      { label: 'Toggle Block Comment', accelerator: 'Shift+Alt+A', action: 'toggleBlockComment' },
    ],
  },
  {
    label: 'Selection',
    items: [
      { label: 'Select All', accelerator: 'Ctrl+A', action: 'selectAll' },
      { label: 'Expand Selection', accelerator: 'Shift+Alt+RightArrow', action: 'expandSelection' },
      { label: 'Shrink Selection', accelerator: 'Shift+Alt+LeftArrow', action: 'shrinkSelection' },
      { separator: true },
      { label: 'Copy Line Up', accelerator: 'Shift+Alt+UpArrow', action: 'copyLineUp' },
      { label: 'Copy Line Down', accelerator: 'Shift+Alt+DownArrow', action: 'copyLineDown' },
      { label: 'Move Line Up', accelerator: 'Alt+UpArrow', action: 'moveLineUp' },
      { label: 'Move Line Down', accelerator: 'Alt+DownArrow', action: 'moveLineDown' },
      { separator: true },
      { label: 'Add Cursor Above', accelerator: 'Ctrl+Alt+UpArrow', action: 'addCursorAbove' },
      { label: 'Add Cursor Below', accelerator: 'Ctrl+Alt+DownArrow', action: 'addCursorBelow' },
      { label: 'Add Next Occurrence', accelerator: 'Ctrl+D', action: 'addNextOccurrence' },
    ],
  },
  {
    label: 'View',
    items: [
      { label: 'Command Palette…', accelerator: 'Ctrl+Shift+P', action: 'commandPalette', disabled: true },
      { label: 'Open View…', action: 'openView', disabled: true },
      { separator: true },
      { label: 'Toggle Primary Side Bar', accelerator: 'Ctrl+B', action: 'togglePrimarySidebar' },
      { label: 'Explorer', accelerator: 'Ctrl+Shift+E', action: 'toggleExplorer' },
      { label: 'Search', accelerator: 'Ctrl+Shift+F', action: 'toggleSearch' },
      { label: 'Source Control', accelerator: 'Ctrl+Shift+G', action: 'toggleScm', disabled: true },
      { label: 'Run', accelerator: 'Ctrl+Shift+D', action: 'toggleRun', disabled: true },
      { label: 'Extensions', accelerator: 'Ctrl+Shift+X', action: 'toggleExtensions', disabled: true },
      { separator: true },
      { label: 'Problems', accelerator: 'Ctrl+Shift+M', action: 'toggleProblems', disabled: true },
      { label: 'Output', accelerator: 'Ctrl+Shift+U', action: 'toggleOutput', disabled: true },
      { label: 'Debug Console', accelerator: 'Ctrl+Shift+Alt+Y', action: 'toggleDebugConsole', disabled: true },
      { label: 'Terminal', accelerator: 'Ctrl+`', action: 'toggleTerminalPanel' },
      { label: 'Chat', accelerator: 'Ctrl+L', action: 'toggleChat' },
      { separator: true },
      { label: 'Word Wrap', accelerator: 'Alt+Z', action: 'toggleWordWrap' },
      { separator: true },
      { label: 'Zoom In', accelerator: 'Ctrl+=', action: 'zoomIn' },
      { label: 'Zoom Out', accelerator: 'Ctrl+-', action: 'zoomOut' },
      { label: 'Reset Zoom', accelerator: 'Ctrl+NumPad0', action: 'resetZoom' },
    ],
  },
  {
    label: 'Go',
    items: [
      { label: 'Go to File…', accelerator: 'Ctrl+P', action: 'goToFile', disabled: true },
      { label: 'Go to Symbol in Workspace…', accelerator: 'Ctrl+T', action: 'goToSymbolWorkspace', disabled: true },
      { label: 'Go to Symbol in Editor…', accelerator: 'Ctrl+Shift+O', action: 'goToSymbolEditor' },
      { separator: true },
      { label: 'Go to Line / Column…', accelerator: 'Ctrl+G', action: 'goToLine' },
    ],
  },
  {
    label: 'Run',
    items: [
      { label: 'Start Debugging', accelerator: 'F5', action: 'startDebugging', disabled: true },
      { label: 'Run Without Debugging', accelerator: 'Ctrl+F5', action: 'runWithoutDebugging', disabled: true },
      { label: 'Stop Debugging', accelerator: 'Shift+F5', action: 'stopDebugging', disabled: true },
      { separator: true },
      { label: 'Toggle Breakpoint', accelerator: 'F9', action: 'toggleBreakpoint', disabled: true },
    ],
  },
  {
    label: 'Terminal',
    items: [{ label: 'New Terminal', accelerator: 'Ctrl+Shift+`', action: 'newTerminal' }],
  },
  {
    label: 'Help',
    items: [
      { label: 'Show All Commands', accelerator: 'Ctrl+Shift+P', action: 'showCommands', disabled: true },
      { separator: true },
      { label: 'Give Feedback…', action: 'noop', disabled: true },
      { label: 'Sign in to Auto-Coder Web…', action: 'openSignIn' },
      { separator: true },
      { label: 'Toggle Developer Tools', accelerator: 'Ctrl+Shift+I', action: 'toggleDevTools' },
      { label: 'Reload Window', accelerator: 'Ctrl+Alt+R', action: 'reloadWindow' },
      { separator: true },
      { label: 'About Auto-Coder', action: 'about' },
    ],
  },
];
