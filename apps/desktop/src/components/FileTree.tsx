import React, { useState } from 'react';
import type { FileNode } from '../App';

interface FileTreeProps {
  nodes: FileNode[];
  onFileOpen: (node: FileNode) => void;
  activeFile: string;
  projectPath: string;
}

const FILE_ICONS: Record<string, string> = {
  '.ts': '📘', '.tsx': '⚛️', '.js': '📙', '.jsx': '⚛️',
  '.py': '🐍', '.go': '🐹', '.rs': '🦀',
  '.css': '🎨', '.scss': '🎨', '.json': '📋',
  '.md': '📄', '.html': '🌐', '.yaml': '⚙️', '.yml': '⚙️',
  '.env': '🔐', '.gitignore': '🙈',
};

function getFileIcon(node: FileNode): string {
  if (node.type === 'directory') return '📁';
  return FILE_ICONS[node.ext || ''] || '📄';
}

function TreeNode({
  node,
  depth,
  onFileOpen,
  activeFile,
}: {
  node: FileNode;
  depth: number;
  onFileOpen: (node: FileNode) => void;
  activeFile: string;
}) {
  const [expanded, setExpanded] = useState(depth < 2);

  const isActive = node.path === activeFile;

  if (node.type === 'directory') {
    return (
      <div>
        <div
          className={`tree-item tree-dir`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setExpanded(p => !p)}
        >
          <span className="tree-arrow">{expanded ? '▾' : '▸'}</span>
          <span className="tree-icon">📁</span>
          <span className="tree-label">{node.name}</span>
        </div>
        {expanded && node.children?.map(child => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            onFileOpen={onFileOpen}
            activeFile={activeFile}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`tree-item tree-file ${isActive ? 'active' : ''}`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={() => onFileOpen(node)}
    >
      <span className="tree-icon">{getFileIcon(node)}</span>
      <span className="tree-label">{node.name}</span>
    </div>
  );
}

export function FileTree({ nodes, onFileOpen, activeFile, projectPath }: FileTreeProps) {
  if (!projectPath) {
    return (
      <div className="file-tree-empty">
        <p>No project open</p>
      </div>
    );
  }

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span>EXPLORER</span>
        <span className="project-name">
          {projectPath.split('/').pop() || projectPath.split('\\').pop()}
        </span>
      </div>
      <div className="file-tree-content">
        {nodes.map(node => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            onFileOpen={onFileOpen}
            activeFile={activeFile}
          />
        ))}
      </div>
    </div>
  );
}
