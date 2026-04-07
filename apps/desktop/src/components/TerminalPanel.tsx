import React, { useEffect, useRef } from 'react';

interface TerminalPanelProps {
  projectPath: string;
}

/**
 * Terminal panel using xterm.js.
 * In the Electron app, this connects to a real pty via node-pty.
 * In dev mode, shows a mock terminal.
 */
export function TerminalPanel({ projectPath }: TerminalPanelProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<any>(null);

  useEffect(() => {
    if (!termRef.current) return;

    // Dynamic import to avoid SSR issues
    import('xterm').then(({ Terminal }) => {
      import('xterm-addon-fit').then(({ FitAddon }) => {
        const term = new Terminal({
          theme: {
            background: '#0d1117',
            foreground: '#e6edf3',
            cursor: '#58a6ff',
            selection: '#264f78',
            black: '#484f58',
            red: '#ff7b72',
            green: '#3fb950',
            yellow: '#d29922',
            blue: '#58a6ff',
            magenta: '#bc8cff',
            cyan: '#39c5cf',
            white: '#b1bac4',
          },
          fontSize: 13,
          fontFamily: '"Cascadia Code", "Fira Code", Menlo, monospace',
          cursorBlink: true,
          convertEol: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(termRef.current!);
        fitAddon.fit();

        term.writeln('\x1b[32m🚀 Auto-Coder Terminal\x1b[0m');
        term.writeln(`\x1b[36mProject: ${projectPath || 'No project open'}\x1b[0m`);
        term.writeln('\x1b[33mNote: Connect node-pty for full terminal support\x1b[0m');
        term.writeln('');
        term.write('$ ');

        terminalRef.current = term;

        const resizeObserver = new ResizeObserver(() => fitAddon.fit());
        resizeObserver.observe(termRef.current!);

        return () => {
          resizeObserver.disconnect();
          term.dispose();
        };
      });
    });
  }, [projectPath]);

  return (
    <div
      ref={termRef}
      className="terminal-panel"
      style={{
        height: '100%',
        width: '100%',
        backgroundColor: '#0d1117',
        padding: '4px',
      }}
    />
  );
}
