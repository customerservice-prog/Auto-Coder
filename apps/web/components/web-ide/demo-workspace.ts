/** In-browser demo tree — mirrors desktop Explorer shape; paths are virtual (no disk I/O). */

export interface WebDemoNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  ext?: string;
  children?: WebDemoNode[];
}

export const WEB_DEMO_PROJECT_NAME = 'web-workspace';

/** Virtual file: synced from Composer /api/agent stream (read-only in Monaco). */
export const AGENT_STREAM_PATH = 'web-demo/AGENT_STREAM.md';

export function formatAgentStreamMd(output: string, err: string | null, busy: boolean): string {
  const lines: string[] = ['# Agent stream', ''];
  if (busy) lines.push('_Streaming…_', '');
  if (err) {
    lines.push('## Error', '', '```text', err, '```', '');
  }
  if (output.trim()) {
    lines.push('## Response', '', '```text', output, '```', '');
  }
  if (!busy && !err && !output.trim()) {
    lines.push('_No output yet — run a mission from Composer._', '');
  }
  return lines.join('\n');
}

export const DEMO_FILE_TREE: WebDemoNode[] = [
  {
    name: WEB_DEMO_PROJECT_NAME,
    path: 'web-demo',
    type: 'directory',
    children: [
      {
        name: 'apps',
        path: 'web-demo/apps',
        type: 'directory',
        children: [
          {
            name: 'web',
            path: 'web-demo/apps/web',
            type: 'directory',
            children: [
              {
                name: 'dashboard',
                path: 'web-demo/apps/web/dashboard',
                type: 'directory',
                children: [
                  {
                    name: 'page.tsx',
                    path: 'web-demo/apps/web/dashboard/page.tsx',
                    type: 'file',
                    ext: '.tsx',
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        name: 'README.md',
        path: 'web-demo/README.md',
        type: 'file',
        ext: '.md',
      },
      {
        name: 'PLAN.md',
        path: 'web-demo/PLAN.md',
        type: 'file',
        ext: '.md',
      },
      {
        name: 'AGENT_STREAM.md',
        path: AGENT_STREAM_PATH,
        type: 'file',
        ext: '.md',
      },
    ],
  },
];

export interface DemoBufferInit {
  name: string;
  language: string;
  content: string;
}

export const DEMO_BUFFERS: Record<string, DemoBufferInit> = {
  'web-demo/README.md': {
    name: 'README.md',
    language: 'markdown',
    content: `# ${WEB_DEMO_PROJECT_NAME}

This is a **demo workspace** in the Auto-Coder web IDE — same chrome as the desktop app (activity bar, Explorer, tabs, Monaco, bottom panel, Composer).

- Paste context and a mission in **Composer** → streamed output appears in **Output**.
- Open real folders and terminals in the **desktop** app; the web shell is for planning and assistant runs.

---

*Built to feel like Cursor — autonomous agent loop ships in desktop + CLI.*
`,
  },
  'web-demo/PLAN.md': {
    name: 'PLAN.md',
    language: 'markdown',
    content: `# PLAN

1. Describe the mission in Composer.
2. Review streamed output below.
3. Apply changes locally (desktop) or copy patches from Output.

*(Agent writes this file on disk in the desktop app — here it is sample text.)*
`,
  },
  'web-demo/apps/web/dashboard/page.tsx': {
    name: 'page.tsx',
    language: 'typescript',
    content: `'use client';

// Sample buffer — your real \`page.tsx\` lives in the repo.
// Composer on the right talks to POST /api/agent.

export default function DashboardPage() {
  return null;
}
`,
  },
};

export const DEFAULT_OPEN_PATH = 'web-demo/README.md';

/** Dirs expanded on first paint (depth ≤ 3). */
export function initialExpandedDirs(): Set<string> {
  const s = new Set<string>();
  function walk(nodes: WebDemoNode[], depth: number) {
    for (const n of nodes) {
      if (n.type === 'directory') {
        if (depth < 5) s.add(n.path);
        walk(n.children ?? [], depth + 1);
      }
    }
  }
  walk(DEMO_FILE_TREE, 0);
  return s;
}

/** Flat demo files for Quick Open (Ctrl+P). */
export function listQuickOpenDemoFiles(): { path: string; name: string }[] {
  const out: { path: string; name: string }[] = [];
  function walk(nodes: WebDemoNode[]) {
    for (const n of nodes) {
      if (n.type === 'file') {
        out.push({ path: n.path, name: n.name });
      }
      if (n.children?.length) walk(n.children);
    }
  }
  walk(DEMO_FILE_TREE);
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}
