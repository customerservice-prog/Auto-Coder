import React, { useState, useRef, useEffect } from 'react';
import type { AgentStatus } from '../App';

interface ChatPanelProps {
  onRunAgent: (mission: string) => void;
  agentStatus: AgentStatus;
  projectPath: string;
  indexedChunks: number;
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

export function ChatPanel({ onRunAgent, agentStatus, projectPath, indexedChunks }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: 'Auto-Coder is ready. Describe your mission and the autonomous agent will plan, execute, test, and self-heal until it is done.',
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div className="chat-title">
          <span className="chat-icon">🤖</span>
          <span>Auto-Coder Agent</span>
        </div>
        <div className="chat-meta">
          {indexedChunks > 0 && (
            <span className="index-badge" title="Indexed code chunks">
              {indexedChunks} chunks
            </span>
          )}
          <div className={`status-indicator ${agentStatus.status}`} />
        </div>
      </div>

      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message message-${msg.role}`}>
            {msg.role === 'system' && <span className="msg-icon">ℹ️</span>}
            {msg.role === 'agent' && <span className="msg-icon">⚙️</span>}
            {msg.role === 'user' && <span className="msg-icon">👤</span>}
            <div className="msg-content">
              <p>{msg.content}</p>
              <span className="msg-time">
                {msg.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {!isRunning && (
        <div className="quick-missions">
          <p className="quick-label">Quick missions:</p>
          <div className="quick-list">
            {QUICK_MISSIONS.map((m, i) => (
              <button
                key={i}
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
        <div className="agent-running">
          <div className="spinner" />
          <span>{agentStatus.message || 'Agent is working...'}</span>
        </div>
      )}

      <div className="chat-input-area">
        <textarea
          ref={textareaRef}
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRunning ? 'Agent is working...' : 'Describe your mission... (Enter to send, Shift+Enter for newline)'}
          disabled={isRunning}
          rows={3}
        />
        <button
          className={`send-btn ${isRunning ? 'disabled' : ''}`}
          onClick={() => handleSubmit()}
          disabled={isRunning || !input.trim()}
        >
          {isRunning ? '⏳' : '🚀'}
        </button>
      </div>
    </div>
  );
}
