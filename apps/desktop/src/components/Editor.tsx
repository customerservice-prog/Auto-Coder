import { useRef, useCallback } from 'react';
import MonacoEditor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { OpenFile } from '../App';

function isUntitledBuffer(path: string): boolean {
  return path.startsWith('untitled:');
}

function editorAriaLabel(file: OpenFile): string {
  const dirty = file.isDirty ? ', modified' : '';
  if (isUntitledBuffer(file.path)) {
    return `Code editor, ${file.name}, not saved to disk${dirty}`;
  }
  return `Code editor, ${file.name}${dirty}`;
}

interface EditorProps {
  file: OpenFile;
  onChange: (value: string | undefined) => void;
  onSave: () => void | Promise<void>;
  onSaveAs: () => void | Promise<void>;
  onSaveAll: () => void | Promise<void>;
  onCloseEditor: () => void;
  onCycleTab: (backward: boolean) => void;
  /** Ctrl+K L / Ctrl+K A (VS Code–style chords): open agent chat with mission prefill (selection-aware). */
  onInlineAiToChat?: (missionPrefill: string) => void;
  onEditorReady?: (instance: editor.IStandaloneCodeEditor) => void;
}

export function Editor({
  file,
  onChange,
  onSave,
  onSaveAs,
  onSaveAll,
  onCloseEditor,
  onCycleTab,
  onInlineAiToChat,
  onEditorReady,
}: EditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const closeRef = useRef(onCloseEditor);
  closeRef.current = onCloseEditor;
  const cycleTabRef = useRef(onCycleTab);
  cycleTabRef.current = onCycleTab;
  const inlineAiRef = useRef(onInlineAiToChat);
  inlineAiRef.current = onInlineAiToChat;

  const handleMount: OnMount = useCallback(
    (editorInstance, monaco) => {
      editorRef.current = editorInstance;
      onEditorReady?.(editorInstance);

    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void onSave();
    });
    editorInstance.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS,
      () => {
        void onSaveAs();
      }
    );
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyS, () => {
      void onSaveAll();
    });
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
      closeRef.current();
    });
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Tab, () => {
      cycleTabRef.current(false);
    });
    editorInstance.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Tab,
      () => {
        cycleTabRef.current(true);
      }
    );
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.PageDown, () => {
      cycleTabRef.current(false);
    });
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.PageUp, () => {
      cycleTabRef.current(true);
    });

    editorInstance.addAction({
      id: 'autocoder.openAgentChatFromEditor',
      label: 'Agent: Open chat from editor',
      keybindings: [
        monaco.KeyMod.chord(
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
          monaco.KeyCode.KeyL,
        ),
        monaco.KeyMod.chord(
          monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
          monaco.KeyCode.KeyA,
        ),
      ],
      run: (ed) => {
        const model = ed.getModel();
        const sel = ed.getSelection();
        let selected = '';
        if (model && sel && !sel.isEmpty()) {
          selected = model.getValueInRange(sel);
        }
        const mission = selected.trim()
          ? `In this file, update or replace the following selection:\n\n${selected}\n\nInstructions:\n`
          : 'In this file:\n';
        inlineAiRef.current?.(mission);
      },
    });

    // Configure editor appearance
    monaco.editor.defineTheme('autocoder-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6' },
        { token: 'string', foreground: 'CE9178' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.foreground': '#d4d4d4',
        'editor.lineHighlightBackground': '#2a2d2e',
        'editorLineNumber.foreground': '#6e7681',
        'editorLineNumber.activeForeground': '#e6edf3',
        'editor.selectionBackground': '#264f78',
        'editorCursor.foreground': '#58a6ff',
      },
    });

    monaco.editor.setTheme('autocoder-dark');

    // Focus editor
    editorInstance.focus();
  },
    [onSave, onSaveAs, onSaveAll, onInlineAiToChat, onEditorReady]
  );

  return (
    <div className="editor-wrapper" style={{ height: '100%', width: '100%' }}>
      <MonacoEditor
        height="100%"
        language={file.language}
        value={file.content}
        theme="autocoder-dark"
        onMount={handleMount}
        onChange={onChange}
        options={{
          accessibilitySupport: 'auto',
          ariaLabel: editorAriaLabel(file),
          fontSize: 14,
          fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Menlo, monospace',
          fontLigatures: true,
          lineNumbers: 'on',
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          formatOnPaste: true,
          formatOnType: true,
          suggestOnTriggerCharacters: true,
          quickSuggestions: { other: true, comments: false, strings: true },
          parameterHints: { enabled: true },
          folding: true,
          foldingHighlight: true,
          bracketPairColorization: { enabled: true },
          guides: { bracketPairs: true, indentation: true },
          renderWhitespace: 'selection',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          padding: { top: 16, bottom: 16 },
        }}
      />
    </div>
  );
}
