import { useState, useRef, useEffect } from 'react';
import type { AgentStatus } from '../App';
import { desktopAccel } from '../desktopAccel';

interface ChatPanelProps {
  onRunAgent: (mission: string) => void;
  agentStatus: AgentStatus;
  projectPath: string;
  indexedChunks: number;
  missionDraft?: { id: number; text: string } | null;
  onMissionDraftConsumed?: () => void;
  /** Escape (when the mission field is enabled) hides the chat panel — same as **Ctrl+L**. */
  onRequestDismiss?: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
}

const QUICK_MISSIONS = [
  'Add comprehensive error handling throughout the codebase',
  'Write unit tests for all exported functions',
  'Refactor for better TypeScript type safety',
  'Add JSDoc comments to all public APIs',
  'Optimize performance — find and fix any slow operations',
];

export function ChatPanel({
  onRunAgent,
  agentStatus,
  projectPath,
  indexedChunks,
  missionDraft,
  onMissionDraftConsumed,
  onRequestDismiss,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content:
        'Auto-Coder is ready. Open a project folder, then describe your mission—the agent will plan, execute, test, and self-heal until it is done.',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!missionDraft) return;
    setInput(missionDraft.text);
    onMissionDraftConsumed?.();
    const raf = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [missionDraft, onMissionDraftConsumed]);

  // Show agent status as messages
  useEffect(() => {
    if (agentStatus.message) {
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'agent') {
          return [...prev.slice(0, -1), { ...lastMsg, content: agentStatus.message }];
        }
        return [...prev, {
          id: Date.now().toString(),
          role: 'agent',
          content: agentStatus.message,
          timestamp: new Date(),
        }];
      });

      if (agentStatus.status === 'done' || agentStatus.status === 'error') {
        setIsRunning(false);
      }
    }
  }, [agentStatus]);

  const handleSubmit = async (mission?: string) => {
    const text = mission || input.trim();
    if (!text || isRunning) return;

    if (!projectPath) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: 'Please open a project folder first.',
        timestamp: new Date(),
      }]);
      return;
    }

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }]);

    setInput('');
    setIsRunning(true);
    onRunAgent(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && onRequestDismiss && !isRunning) {
      e.preventDefault();
      onRequestDismiss();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-panel" role="complementary" aria-labelledby="chat-panel-heading">
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-icon" aria-hidden="true">
            🤖
          </span>
          <h2 className="chat-panel-heading" id="chat-panel-heading">
            Auto-Coder Agent
          </h2>
        </div>
        <div className="chat-meta">
          {indexedChunks > 0 && (
            <span
              className="index-badge"
              title="Indexed code chunks"
              aria-label={`${indexedChunks} indexed code chunks available for AI context`}
            >
              {indexedChunks} chunks
            </span>
          )}
          <div className={`status-indicator ${agentStatus.status}`} aria-hidden="true" />
        </div>
      </div>

      <div
        className="messages"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Agent conversation"
      >
        {messages.map(msg => (
          <div key={msg.id} className={`message message-${msg.role}`}>
            {msg.role === 'system' && (
              <span className="msg-icon" aria-hidden="true">
                ℹ️
              </span>
            )}
            {msg.role === 'agent' && (
              <span className="msg-icon" aria-hidden="true">
                ⚙️
              </span>
            )}
            {msg.role === 'user' && (
              <span className="msg-icon" aria-hidden="true">
                👤
              </span>
            )}
            <div className="msg-content">
              <p>{msg.content}</p>
              <span className="msg-time">
                <time dateTime={msg.timestamp.toISOString()}>{msg.timestamp.toLocaleTimeString()}</time>
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {!isRunning && projectPath && (
        <div className="quick-missions" role="region" aria-labelledby="chat-quick-heading">
          <h3 className="chat-quick-heading" id="chat-quick-heading">
            Quick missions
          </h3>
          <div className="quick-list">
            {QUICK_MISSIONS.map((m, i) => (
              <button
                key={i}
                type="button"
                className="quick-btn"
                onClick={() => handleSubmit(m)}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {isRunning && (
        <div className="agent-running" role="status" aria-live="polite" aria-atomic="true">
          <div className="spinner" aria-hidden="true" />
          <span>{agentStatus.message || 'Agent is working...'}</span>
        </div>
      )}

      <div className="chat-input-area">
        <textarea
          ref={textareaRef}
          className="chat-input"
          autoComplete="off"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Agent mission"
          placeholder={
            isRunning
              ? 'Agent is working...'
              : projectPath
                ? 'Describe your mission... (Enter to send, Shift+Enter for newline, Esc to hide panel)'
                : `Open a project folder first (File → Open Folder… or ${desktopAccel('openFolder')})...`
          }
          disabled={isRunning || !projectPath}
          rows={3}
        />
        <button
          type="button"
          className={`send-btn ${isRunning || !projectPath ? 'disabled' : ''}`}
          aria-label={isRunning ? 'Agent running' : 'Send mission to agent'}
          onClick={() => handleSubmit()}
          disabled={isRunning || !projectPath || !input.trim()}
        >
          {isRunning ? '⏳' : '🚀'}
        </button>
      </div>
    </div>
  );
}
