'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { editor } from 'monaco-editor';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="wb-monaco-loading" aria-busy="true">
      Loading editor…
    </div>
  ),
});

export interface WebMonacoPaneProps {
  path: string;
  language: string;
  value: string;
  readOnly?: boolean;
  minimapEnabled?: boolean;
  onChange?: (value: string) => void;
  /** Fires when the Monaco instance is ready (e.g. for global zoom shortcuts). */
  onEditorReady?: (editorInstance: editor.IStandaloneCodeEditor) => void;
  /** Cursor moves (for status bar Ln/Col). */
  onCursorPositionChange?: (lineNumber: number, column: number) => void;
}

export function WebMonacoPane({
  path,
  language,
  value,
  readOnly,
  minimapEnabled = false,
  onChange,
  onEditorReady,
  onCursorPositionChange,
}: WebMonacoPaneProps) {
  const [monacoLoaderReady, setMonacoLoaderReady] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const cursorDisposableRef = useRef<{ dispose: () => void } | null>(null);

  /** Must run only in the browser — importing `monaco-editor` at module scope breaks SSR. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const monaco = await import('monaco-editor');
        const { loader } = await import('@monaco-editor/react');
        loader.config({ monaco });
        if (!cancelled) setMonacoLoaderReady(true);
      } catch {
        if (!cancelled) setMonacoLoaderReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(
    (): editor.IStandaloneEditorConstructionOptions => ({
      minimap: { enabled: Boolean(minimapEnabled), scale: 0.85, maxColumn: 120 },
      fontSize: 13,
      lineHeight: 20,
      lineNumbers: 'on',
      lineNumbersMinChars: 3,
      glyphMargin: true,
      folding: true,
      padding: { top: 8, bottom: 8 },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      renderLineHighlight: 'line',
      bracketPairColorization: { enabled: true },
      automaticLayout: true,
      readOnly: Boolean(readOnly),
      tabSize: 2,
      insertSpaces: true,
    }),
    [readOnly, minimapEnabled],
  );

  useEffect(() => {
    return () => {
      cursorDisposableRef.current?.dispose();
      cursorDisposableRef.current = null;
      editorRef.current = null;
    };
  }, [path]);

  const onMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
      monaco.editor.setTheme('vs-dark');
      editorInstance.focus();
      editorRef.current = editorInstance;
      cursorDisposableRef.current?.dispose();
      cursorDisposableRef.current = null;
      onEditorReady?.(editorInstance);
      if (onCursorPositionChange) {
        const d = editorInstance.onDidChangeCursorPosition((ev) => {
          onCursorPositionChange(ev.position.lineNumber, ev.position.column);
        });
        cursorDisposableRef.current = d;
        const pos = editorInstance.getPosition();
        if (pos) {
          onCursorPositionChange(pos.lineNumber, pos.column);
        }
      }
    },
    [onEditorReady, onCursorPositionChange],
  );

  return (
    <div className="wb-monaco-root">
      {!monacoLoaderReady ? (
        <div className="wb-monaco-loading" aria-busy="true">
          Loading editor…
        </div>
      ) : (
        <MonacoEditor
          key={path}
          height="100%"
          theme="vs-dark"
          path={path}
          language={language}
          value={value}
          options={options}
          onMount={onMount}
          onChange={readOnly ? undefined : (v) => onChange?.(v ?? '')}
        />
      )}
    </div>
  );
}
