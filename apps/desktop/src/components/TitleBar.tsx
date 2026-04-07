import React from 'react';

interface TitleBarProps {
  projectPath: string;
  onOpenFolder: () => void;
}

export function TitleBar({ projectPath, onOpenFolder }: TitleBarProps) {
  const projectName = projectPath
    ? (projectPath.split('/').pop() || projectPath.split('\\').pop())
    : null;

  return (
    <div className="title-bar">
      <div className="title-bar-drag" />
      <div className="title-bar-content">
        <div className="title-logo">
          <span>🚀</span>
          <span className="title-name">Auto-Coder</span>
        </div>

        <div className="title-actions">
          <button className="title-btn" onClick={onOpenFolder} title="Open Project Folder">
            📁 {projectName ? projectName : 'Open Folder'}
          </button>
        </div>
      </div>
    </div>
  );
}
