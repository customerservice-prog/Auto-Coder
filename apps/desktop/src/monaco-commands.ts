import type { editor } from 'monaco-editor';

/** Try action ids in order until one runs (Monaco minor-version differences). */
export function runEditorAction(
  editorInstance: editor.IStandaloneCodeEditor | null,
  ...ids: string[]
): boolean {
  if (!editorInstance) return false;
  for (const id of ids) {
    const action = editorInstance.getAction(id);
    if (action) {
      void action.run();
      return true;
    }
  }
  return false;
}

export const MonacoIds = {
  undo: ['editor.action.undo'],
  redo: ['editor.action.redo'],
  cut: ['editor.action.clipboardCutAction'],
  copy: ['editor.action.clipboardCopyAction'],
  paste: ['editor.action.clipboardPasteAction'],
  find: ['actions.find', 'editor.action.startFind'],
  replace: ['editor.action.startFindReplaceAction'],
  lineComment: ['editor.action.commentLine'],
  blockComment: ['editor.action.blockComment'],
  wordWrap: ['editor.action.toggleWordWrap'],
  selectAll: ['editor.action.selectAll'],
  gotoLine: ['editor.action.gotoLine'],
  goToSymbolEditor: ['editor.action.quickOutline'],
  expandSelection: ['editor.action.smartSelect.expand'],
  shrinkSelection: ['editor.action.smartSelect.shrink'],
  copyLineUp: ['editor.action.copyLinesUpAction'],
  copyLineDown: ['editor.action.copyLinesDownAction'],
  moveLineUp: ['editor.action.moveLinesUpAction'],
  moveLineDown: ['editor.action.moveLinesDownAction'],
  addCursorAbove: ['editor.action.insertCursorAbove'],
  addCursorBelow: ['editor.action.insertCursorBelow'],
  addNextOccurrence: ['editor.action.addSelectionToNextFindMatch'],
  zoomIn: ['editor.action.fontZoomIn'],
  zoomOut: ['editor.action.fontZoomOut'],
  zoomReset: ['editor.action.fontZoomReset'],
} as const;
