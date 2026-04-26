'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { editor } from 'monaco-editor';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="wb-monaco-loading wb-monaco-loading-silent" aria-hidden />,
});

export interface WebMonacoPaneProps {
  path: string;
  language: string;
  value: string;
  readOnly?: boolean;
  minimapEnabled?: boolean;
  /** Restored when switching back to this file (scroll + cursor). */
  savedViewState?: editor.ICodeEditorViewState | null;
  /** Called when this path unmounts so the parent can cache view state. */
  onSaveViewState?: (path: string, state: editor.ICodeEditorViewState | null) => void;
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
  savedViewState,
  onSaveViewState,
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
      minimap: { enabled: Boolean(minimapEnabled), scale: 0.6, maxColumn: 72 },
      fontSize: 12,
      lineHeight: 17,
      lineNumbers: 'on',
      lineNumbersMinChars: 1,
      glyphMargin: false,
      folding: true,
      overviewRulerBorder: false,
      padding: { top: 1, bottom: 1 },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      smoothScrolling: false,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8,
        useShadows: false,
      },
      cursorBlinking: 'solid',
      cursorStyle: 'line',
      cursorWidth: 1,
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
      const ed = editorRef.current;
      if (ed && onSaveViewState) {
        try {
          onSaveViewState(path, ed.saveViewState());
        } catch {
          onSaveViewState(path, null);
        }
      }
      cursorDisposableRef.current?.dispose();
      cursorDisposableRef.current = null;
      editorRef.current = null;
    };
  }, [path, onSaveViewState]);

  const onMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
      monaco.editor.defineTheme('ac-cursor', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#1e1e1e',
          'editor.foreground': '#d4d4d4',
          'editorGutter.background': '#1e1e1e',
          'editorLineNumber.foreground': '#1c1c1c',
          'editorLineNumber.activeForeground': '#353535',
          'editor.lineHighlightBackground': '#202020',
          'editor.lineHighlightBorder': '#00000000',
          'editor.selectionBackground': '#3d3d3d',
          'editor.inactiveSelectionBackground': '#353535',
          'editorCursor.foreground': '#c8c8c8',
          'editorWhitespace.foreground': '#3b3a39',
          'minimap.background': '#1e1e1e',
          'minimapSlider.background': '#79797933',
          'minimapSlider.hoverBackground': '#63636359',
          'minimapSlider.activeBackground': '#bfbfbf66',
          'scrollbarSlider.background': 'rgba(255, 255, 255, 0.06)',
          'scrollbarSlider.hoverBackground': 'rgba(255, 255, 255, 0.12)',
          'scrollbarSlider.activeBackground': 'rgba(255, 255, 255, 0.16)',
        },
      });
      monaco.editor.setTheme('ac-cursor');
      if (savedViewState) {
        try {
          editorInstance.restoreViewState(savedViewState);
        } catch {
          /* ignore */
        }
      }
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
    [onEditorReady, onCursorPositionChange, savedViewState],
  );

  return (
    <div className="wb-monaco-root">
      {!monacoLoaderReady ? (
        <div className="wb-monaco-loading wb-monaco-loading-silent" aria-hidden />
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
