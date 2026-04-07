import React, { useRef, useCallback } from 'react';
import MonacoEditor, { OnMount, OnChange } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { OpenFile } from '../App';

interface EditorProps {
  file: OpenFile;
  onChange: (value: string | undefined) => void;
  onSave: () => void;
}

export function Editor({ file, onChange, onSave }: EditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = useCallback((editorInstance, monaco) => {
    editorRef.current = editorInstance;

    // Save on Ctrl+S / Cmd+S
    editorInstance.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => onSave()
    );

    // Inline AI edit on Ctrl+K / Cmd+K
    editorInstance.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK,
      () => {
        // TODO: trigger inline edit popup
        console.log('[Editor] Ctrl+K: Trigger inline AI edit');
      }
    );

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
        'editor.background': '#0d1117',
        'editor.foreground': '#e6edf3',
        'editor.lineHighlightBackground': '#161b22',
        'editorLineNumber.foreground': '#6e7681',
        'editorLineNumber.activeForeground': '#e6edf3',
        'editor.selectionBackground': '#264f78',
        'editorCursor.foreground': '#58a6ff',
      },
    });

    monaco.editor.setTheme('autocoder-dark');

    // Focus editor
    editorInstance.focus();
  }, [onSave]);

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
