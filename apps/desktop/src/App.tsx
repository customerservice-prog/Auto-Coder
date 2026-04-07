import React, { useState, useEffect, useCallback } from 'react';
import { Editor } from './components/Editor';
import { ChatPanel } from './components/ChatPanel';
import { FileTree } from './components/FileTree';
import { TerminalPanel } from './components/TerminalPanel';
import { StatusBar } from './components/StatusBar';
import { TitleBar } from './components/TitleBar';
import './App.css';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  ext?: string;
  children?: FileNode[];
}

export interface AgentStatus {
  status: 'idle' | 'planning' | 'executing' | 'testing' | 'done' | 'error';
  message: string;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  language: string;
}

function getLanguage(ext: string): string {
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescriptreact',
    '.js': 'javascript', '.jsx': 'javascriptreact',
    '.py': 'python', '.go': 'go', '.rs': 'rust',
    '.css': 'css', '.scss': 'scss',
    '.json': 'json', '.md': 'markdown',
    '.html': 'html', '.yaml': 'yaml', '.yml': 'yaml',
  };
  return map[ext] || 'plaintext';
}

export default function App() {
  const [projectPath, setProjectPath] = useState<string>('');
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string>('');
  const [agentStatus, setAgentStatus] = useState<AgentStatus>({ status: 'idle', message: '' });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [indexedChunks, setIndexedChunks] = useState(0);

  // Listen for agent events from Electron main process
  useEffect(() => {
    if (!window.autocoder) return;

    const unsubStatus = window.autocoder.onAgentStatus(({ status, message }) => {
      setAgentStatus({ status: status as AgentStatus['status'], message });
    });

    const unsubFileChange = window.autocoder.onAgentFileChange(({ filePath, content }) => {
      setOpenFiles(prev => prev.map(f =>
        f.path.endsWith(filePath) ? { ...f, content, isDirty: false } : f
      ));
    });

    const unsubIndex = window.autocoder.onIndexComplete(({ total }) => {
      setIndexedChunks(total);
    });

    return () => { unsubStatus(); unsubFileChange(); unsubIndex(); };
  }, []);

  const handleOpenFolder = useCallback(async () => {
    if (!window.autocoder) return;
    const folder = await window.autocoder.openFolder();
    if (folder) {
      setProjectPath(folder);
      const tree = await window.autocoder.getFileTree(folder);
      setFileTree(tree);
      // Auto-index the codebase
      window.autocoder.indexCodebase(folder).then(count => setIndexedChunks(count));
    }
  }, []);

  const handleOpenFile = useCallback(async (node: FileNode) => {
    if (node.type !== 'file' || !window.autocoder) return;

    if (openFiles.find(f => f.path === node.path)) {
      setActiveFile(node.path);
      return;
    }

    const content = await window.autocoder.readFile(node.path);
    const newFile: OpenFile = {
      path: node.path,
      name: node.name,
      content,
      isDirty: false,
      language: getLanguage(node.ext || ''),
    };

    setOpenFiles(prev => [...prev, newFile]);
    setActiveFile(node.path);
  }, [openFiles]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (!activeFile || !value) return;
    setOpenFiles(prev => prev.map(f =>
      f.path === activeFile ? { ...f, content: value, isDirty: true } : f
    ));
  }, [activeFile]);

  const handleSave = useCallback(async () => {
    const file = openFiles.find(f => f.path === activeFile);
    if (!file || !window.autocoder) return;
    await window.autocoder.writeFile(file.path, file.content);
    setOpenFiles(prev => prev.map(f => f.path === activeFile ? { ...f, isDirty: false } : f));
  }, [openFiles, activeFile]);

  const handleCloseFile = useCallback((filePath: string) => {
    setOpenFiles(prev => prev.filter(f => f.path !== filePath));
    if (activeFile === filePath) {
      const remaining = openFiles.filter(f => f.path !== filePath);
      setActiveFile(remaining[remaining.length - 1]?.path || '');
    }
  }, [openFiles, activeFile]);

  const handleRunAgent = useCallback(async (mission: string) => {
    if (!window.autocoder || !projectPath) return;
    setAgentStatus({ status: 'planning', message: 'Starting mission...' });
    try {
      const result = await window.autocoder.runAgent(mission, projectPath);
      setAgentStatus({ status: 'done', message: `Done! ${result.filesChanged.length} files changed` });
      // Refresh file tree
      const tree = await window.autocoder.getFileTree(projectPath);
      setFileTree(tree);
    } catch (err) {
      setAgentStatus({ status: 'error', message: String(err) });
    }
  }, [projectPath]);

  const activeFileData = openFiles.find(f => f.path === activeFile);

  return (
    <div className="app">
      <TitleBar
        projectPath={projectPath}
        onOpenFolder={handleOpenFolder}
      />

      <div className="app-body">
        {/* File Tree Sidebar */}
        {sidebarOpen && (
          <div className="sidebar">
            <FileTree
              nodes={fileTree}
              onFileOpen={handleOpenFile}
              activeFile={activeFile}
              projectPath={projectPath}
            />
          </div>
        )}

        {/* Main Editor Area */}
        <div className="main-area">
          {/* Tab Bar */}
          <div className="tab-bar">
            {openFiles.map(file => (
              <div
                key={file.path}
                className={`tab ${file.path === activeFile ? 'active' : ''}`}
                onClick={() => setActiveFile(file.path)}
              >
                <span className="tab-name">{file.isDirty ? '● ' : ''}{file.name}</span>
                <button
                  className="tab-close"
                  onClick={(e) => { e.stopPropagation(); handleCloseFile(file.path); }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Editor */}
          <div className="editor-container">
            {activeFileData ? (
              <Editor
                file={activeFileData}
                onChange={handleEditorChange}
                onSave={handleSave}
              />
            ) : (
              <div className="welcome-screen">
                <div className="welcome-content">
                  <h1>🚀 Auto-Coder</h1>
                  <p>Autonomous AI-powered IDE</p>
                  {!projectPath ? (
                    <button className="btn-primary" onClick={handleOpenFolder}>
                      Open Project Folder
                    </button>
                  ) : (
                    <p className="hint">Select a file from the sidebar to start editing</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Terminal Panel */}
          {terminalOpen && (
            <div className="terminal-container">
              <TerminalPanel projectPath={projectPath} />
            </div>
          )}
        </div>

        {/* Chat / Agent Panel */}
        {chatOpen && (
          <div className="chat-panel-container">
            <ChatPanel
              onRunAgent={handleRunAgent}
              agentStatus={agentStatus}
              projectPath={projectPath}
              indexedChunks={indexedChunks}
            />
          </div>
        )}
      </div>

      <StatusBar
        agentStatus={agentStatus}
        projectPath={projectPath}
        indexedChunks={indexedChunks}
        onToggleSidebar={() => setSidebarOpen(p => !p)}
        onToggleChat={() => setChatOpen(p => !p)}
        onToggleTerminal={() => setTerminalOpen(p => !p)}
      />
    </div>
  );
}
