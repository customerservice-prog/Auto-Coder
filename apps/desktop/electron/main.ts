import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { runAgent } from '@auto-coder/ai-core';
import { indexCodebase, searchCodebase } from '@auto-coder/indexer';

const isDev = process.env.NODE_ENV !== 'production';
let mainWindow: BrowserWindow | null = null;
let currentProjectPath = '';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0d1117',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ============ IPC HANDLERS ============

// Open folder dialog
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (!result.canceled && result.filePaths[0]) {
    currentProjectPath = result.filePaths[0];
    return currentProjectPath;
  }
  return null;
});

// Get file tree
ipcMain.handle('fs:getFileTree', async (_, dirPath?: string) => {
  const target = dirPath || currentProjectPath;
  if (!target) return [];
  return getFileTree(target);
});

// Read file
ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  return fs.readFile(filePath, 'utf-8');
});

// Write file
ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
  await fs.writeFile(filePath, content, 'utf-8');
  return true;
});

// Run agent
ipcMain.handle('agent:run', async (_, mission: string, projectPath?: string) => {
  const target = projectPath || currentProjectPath;
  if (!target) throw new Error('No project path set');

  const result = await runAgent(mission, {
    projectPath: target,
    onStatusChange: (status, message) => {
      mainWindow?.webContents.send('agent:status', { status, message });
    },
    onFileChange: (filePath, content) => {
      mainWindow?.webContents.send('agent:fileChange', { filePath, content });
    },
  });

  return result;
});

// Index codebase
ipcMain.handle('indexer:index', async (_, projectPath?: string) => {
  const target = projectPath || currentProjectPath;
  if (!target) throw new Error('No project path set');

  const chunks = await indexCodebase({
    projectPath: target,
    watchMode: true,
    onIndexComplete: (total) => {
      mainWindow?.webContents.send('indexer:complete', { total });
    },
  });

  return chunks.length;
});

// Search codebase
ipcMain.handle('indexer:search', async (_, query: string, topK = 10) => {
  return searchCodebase(query, topK);
});

// File tree helper
async function getFileTree(dir: string, depth = 0): Promise<any[]> {
  if (depth > 5) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const IGNORE = ['node_modules', '.git', 'dist', 'build', '.next', '.turbo'];
  const tree = [];

  for (const entry of entries) {
    if (IGNORE.includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      tree.push({
        name: entry.name,
        path: fullPath,
        type: 'directory',
        children: await getFileTree(fullPath, depth + 1),
      });
    } else {
      tree.push({
        name: entry.name,
        path: fullPath,
        type: 'file',
        ext: path.extname(entry.name),
      });
    }
  }

  return tree.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
