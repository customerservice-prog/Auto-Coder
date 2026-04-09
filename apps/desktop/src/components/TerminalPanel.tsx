import { useEffect, useRef } from 'react';
import type { ITerminalAddon, Terminal } from 'xterm';

interface TerminalPanelProps {
  projectPath: string;
}

export function TerminalPanel({ projectPath }: TerminalPanelProps) {
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = termRef.current;
    const bridge = window.autocoder;
    if (!el || !bridge) return;

    let disposed = false;
    let term: Terminal | null = null;
    let fitAddon: (ITerminalAddon & { fit: () => void }) | null = null;
    let ro: ResizeObserver | null = null;
    let unsubData: (() => void) | undefined;
    let unsubExit: (() => void) | undefined;
    let termId: string | null = null;

    const setup = async () => {
      const { Terminal: XTerm } = await import('xterm');
      const { FitAddon: Fit } = await import('xterm-addon-fit');
      await import('xterm/css/xterm.css');
      if (disposed || !termRef.current) return;

      term = new XTerm({
        theme: {
          background: '#0d1117',
          foreground: '#e6edf3',
          cursor: '#58a6ff',
          selectionBackground: '#264f78',
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

      fitAddon = new Fit() as ITerminalAddon & { fit: () => void };
      term.loadAddon(fitAddon);
      term.open(termRef.current);
      fitAddon.fit();

      try {
        const created = await bridge.terminalCreate({
          cwd: projectPath.trim() ? projectPath : undefined,
        });
        if (disposed || !term) return;
        termId = created.id;
        term.writeln(`\x1b[32mAuto-Coder terminal\x1b[0m — \x1b[36m${created.cwd}\x1b[0m\r\n`);

        unsubData = bridge.onTerminalData((ev: { id: string; data: string }) => {
          if (ev.id !== termId || !term) return;
          term.write(ev.data);
        });
        unsubExit = bridge.onTerminalExit((ev: { id: string }) => {
          if (ev.id !== termId || !term) return;
          term.writeln('\r\n\x1b[33m[Process exited]\x1b[0m\r\n');
        });

        await bridge.terminalResize(termId, term.cols, term.rows);

        term.onData((data) => {
          if (termId) void bridge.terminalWrite(termId, data);
        });

        ro = new ResizeObserver(() => {
          fitAddon?.fit();
          if (termId && term) void bridge.terminalResize(termId, term.cols, term.rows);
        });
        ro.observe(termRef.current);
      } catch (err) {
        term?.writeln(`\x1b[31mCould not start shell: ${String(err)}\x1b[0m`);
      }
    };

    void setup();

    return () => {
      disposed = true;
      ro?.disconnect();
      unsubData?.();
      unsubExit?.();
      if (termId) void bridge.terminalKill(termId);
      term?.dispose();
    };
  }, [projectPath]);

  return (
    <div
      ref={termRef}
      className="terminal-panel"
      role="region"
      aria-label="Integrated terminal"
      style={{
        height: '100%',
        width: '100%',
        backgroundColor: '#0d1117',
        padding: '4px',
      }}
    />
  );
}
