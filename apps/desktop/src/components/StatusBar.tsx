import React from 'react';
import type { AgentStatus } from '../App';

interface StatusBarProps {
  agentStatus: AgentStatus;
  projectPath: string;
  indexedChunks: number;
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
  onToggleSidebar,
  onToggleChat,
  onToggleTerminal,
}: StatusBarProps) {
  const projectName = projectPath
    ? (projectPath.split('/').pop() || projectPath.split('\\').pop() || 'Project')
    : 'No Project';

  return (
    <div className="status-bar">
      <div className="status-left">
        <button className="status-btn" onClick={onToggleSidebar} title="Toggle Sidebar">
          ☰
        </button>
        <span className="status-project">📁 {projectName}</span>
        {indexedChunks > 0 && (
          <span className="status-indexed" title="Indexed code chunks for AI context">
            ⚡ {indexedChunks} chunks
          </span>
        )}
      </div>

      <div className="status-center">
        <span
          className="status-agent"
          style={{ color: STATUS_COLORS[agentStatus.status] }}
        >
          {STATUS_LABELS[agentStatus.status]}
          {agentStatus.message && (
            <span className="status-msg"> — {agentStatus.message.slice(0, 60)}</span>
          )}
        </span>
      </div>

      <div className="status-right">
        <button className="status-btn" onClick={onToggleTerminal} title="Toggle Terminal">
          ⌨️ Terminal
        </button>
        <button className="status-btn" onClick={onToggleChat} title="Toggle Agent Panel">
          🤖 Agent
        </button>
        <span className="status-version">Auto-Coder v0.1.0</span>
      </div>
    </div>
  );
}
