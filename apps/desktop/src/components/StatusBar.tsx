import type { AgentStatus } from '../App';
import { desktopAccel } from '../desktopAccel';

export interface StatusFileContext {
  /** Shown in the bar (often workspace-relative). */
  display: string;
  /** Full path for tooltip / copy; omit when untitled. */
  fullPath: string | null;
  isUntitled: boolean;
}

interface StatusBarProps {
  agentStatus: AgentStatus;
  projectPath: string;
  indexedChunks: number;
  fileContext: StatusFileContext | null;
  onCopyActivePath: () => void;
  onToggleSidebar: () => void;
  onToggleChat: () => void;
  onToggleTerminal: () => void;
}

const STATUS_COLORS: Record<AgentStatus['status'], string> = {
  idle: '#6e7681',
  planning: '#d29922',
  executing: '#58a6ff',
  testing: '#bc8cff',
  done: '#3fb950',
  error: '#f85149',
};

const STATUS_LABELS: Record<AgentStatus['status'], string> = {
  idle: '● Idle',
  planning: '◐ Planning',
  executing: '◑ Executing',
  testing: '◒ Testing',
  done: '✓ Done',
  error: '✗ Error',
};

export function StatusBar({
  agentStatus,
  projectPath,
  indexedChunks,
  fileContext,
  onCopyActivePath,
  onToggleSidebar,
  onToggleChat,
  onToggleTerminal,
}: StatusBarProps) {
  const projectName = projectPath
    ? (projectPath.split('/').pop() || projectPath.split('\\').pop() || 'Project')
    : 'No Project';

  return (
    <div className="status-bar" role="region" aria-label="Status bar">
      <div className="status-left">
        <button
          type="button"
          className="status-btn"
          onClick={onToggleSidebar}
          title={`Toggle sidebar (${desktopAccel('togglePrimarySidebar')})`}
          aria-label={`Toggle primary sidebar, ${desktopAccel('togglePrimarySidebar')}`}
        >
          ☰
        </button>
        <span className="status-project">📁 {projectName}</span>
        {indexedChunks > 0 && (
          <span className="status-indexed" title="Indexed code chunks for AI context">
            ⚡ {indexedChunks} chunks
          </span>
        )}
        {fileContext && (
          <button
            type="button"
            className="status-file"
            title={
              fileContext.isUntitled
                ? 'Untitled (not on disk)'
                : `${fileContext.fullPath ?? fileContext.display} — click to copy path`
            }
            aria-label={
              fileContext.isUntitled
                ? 'Active file is untitled (not on disk)'
                : `Copy path: ${fileContext.fullPath ?? fileContext.display}`
            }
            disabled={fileContext.isUntitled}
            onClick={() => onCopyActivePath?.()}
          >
            📄 <span className="status-file-path">{fileContext.display}</span>
          </button>
        )}
      </div>

      <div className="status-center">
        <span
          className="status-agent"
          role="status"
          aria-live="polite"
          style={{ color: STATUS_COLORS[agentStatus.status] }}
        >
          {STATUS_LABELS[agentStatus.status]}
          {agentStatus.message && (
            <span className="status-msg"> — {agentStatus.message.slice(0, 60)}</span>
          )}
        </span>
      </div>

      <div className="status-right">
        <button
          type="button"
          className="status-btn"
          onClick={onToggleTerminal}
          title={`Toggle Terminal (${desktopAccel('toggleTerminal')})`}
          aria-label={`Toggle terminal, ${desktopAccel('toggleTerminal')}`}
        >
          ⌨️ Terminal
        </button>
        <button
          type="button"
          className="status-btn"
          onClick={onToggleChat}
          title={`Toggle Agent panel (${desktopAccel('toggleChat')})`}
          aria-label={`Toggle agent chat, ${desktopAccel('toggleChat')}`}
        >
          🤖 Agent
        </button>
        <span className="status-version">Auto-Coder v0.1.0</span>
      </div>
    </div>
  );
}
