# 🚀 Auto-Coder — Setup Guide

> Open this in Cursor and you're ready to build. Follow these steps exactly.

---

## Step 1 — Clone & Open in Cursor

```bash
git clone <your-private-repo-url>
cd Auto-Coder
```

Then in Cursor: **File → Open Folder** → select the `Auto-Coder` folder.

---

## Step 2 — Install Dependencies

You need **Node.js 20+** and **pnpm 9+**.

```bash
# Install pnpm if you don't have it
npm install -g pnpm

# Install all workspace dependencies
pnpm install
```

---

## Step 3 — Set Up Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in your keys. At minimum you need:

| Key | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |
| `OPENAI_API_KEY` | https://platform.openai.com |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | https://clerk.dev (free) |
| `CLERK_SECRET_KEY` | https://clerk.dev |

All other keys (Stripe, Supabase, E2B) are optional for initial dev.

---

## Step 4 — Run the Desktop IDE

```bash
pnpm dev:desktop
```

This starts the Electron app. The IDE will open automatically.

If you **Open File…** before **Open Folder…**, the app treats the file’s parent folder as the workspace (Explorer, indexer, and agent all use that directory). The same applies when your first on-disk step is **Save** or **Save As…** on an untitled buffer.

When a project folder is already set, **Save As…** opens the system dialog with **default location** in that folder (filename only in the field). **Open Folder…** and **Open File…** start the picker in the **current project** (or last workspace root) when available. **Open File…** prefers the **active editor tab’s folder** when you already have a saved file open.

Optional: copy `apps/desktop/.env.example` to `apps/desktop/.env`. Setting **`VITE_DEV_PORT`** there changes the Vite dev server port and is picked up by both **Vite** (`vite.config.ts`) and the **Electron main** process so navigation and `loadURL` stay aligned (default remains **5173**).

**File → Close Window** closes the current window (unsaved buffers prompt first). **File → Exit** quits the application (`app.quit`). On **macOS**, closing the last window typically leaves the app running in the dock until you quit explicitly; on **Windows** with a single window, closing it usually ends the process too.

**File → Reveal in Folder** opens the system file manager on the active saved file, or on the open project folder when no disk file is active. **File → Copy Path of Active File** copies the full path; the status bar shows it (workspace-relative when possible)—click to copy (saved files only). The desktop shell currently rejects **read/save** over IPC for files **larger than ~25 MB** (to keep the renderer stable).

In the **Explorer** sidebar, **Refresh Explorer** (↻ in the header, or **File → Refresh Explorer**) re-reads the project folder from disk. While the agent edits files, the tree also updates shortly after each change so new files show up without a manual refresh.

The in-memory **code indexer** (used for agent context) watches the same project folder: **add**, **change**, and **delete** events update chunks and refresh the **chunks** count in the UI. **Explorer** and the indexer both skip noisy paths (`node_modules`, `.git`, build output, **`.cursor`**, **`.auto-coder-memory`**, etc.); agent session memory is stored under **`.auto-coder-memory`** in the project.

**Desktop shortcuts (Windows / Linux; use Cmd where you see Ctrl on macOS):**

| Shortcut | Action |
| --- | --- |
| F10 | Focus the **application menu bar** (first top-level menu); **Shift+F10** is left untouched. Ignored while the chat mission field, terminal, or a Monaco overlay has focus. On macOS you may need **Fn+F10**. |
| Ctrl+Q / Cmd+Q | Quit the app (same unsaved confirm as **File → Exit**; not sent while chat, terminal, or a Monaco overlay is focused) |
| Ctrl+N | New text file |
| Ctrl+O | Open file… |
| Ctrl+Alt+O | Open folder… |
| Ctrl+S | Save |
| Ctrl+Shift+S | Save as… |
| Ctrl+Alt+S | Save all (saved files only) |
| Ctrl+W | Close active editor tab |
| *(menu)* | **File → Close All Editors** clears every tab (single confirm if any buffer is dirty) |
| Ctrl+Tab / Ctrl+Shift+Tab | Next / previous editor tab |
| Ctrl+PageDown / Ctrl+PageUp | Next / previous editor tab |
| Tab bar (keyboard) | **←** / **→** switch the active tab; **Home** / **End** first / last tab; **Delete** or **Backspace** closes the focused tab (same unsaved prompt as **Ctrl+W**; focus the tab row first; **×** is mouse-only) |
| Ctrl+` | Toggle terminal |
| Ctrl+Shift+` | New terminal (opens panel) |
| Ctrl+L | Toggle chat |
| Ctrl+K → L or A | VS Code–style **chord**: **Ctrl+K** / **Cmd+K**, then **L** or **A** alone—opens agent chat with a file-scratch mission; includes the **current selection** when non-empty (editor focused) |
| Ctrl+G | Go to line / column (when an editor tab is open) |
| Alt+Z | Toggle word wrap (when an editor tab is open) |
| Ctrl+Shift+O | Go to symbol in editor (when an editor tab is open) |
| Ctrl+B | Toggle primary sidebar (Explorer / Search column) |
| Ctrl+Shift+E | Open Explorer side bar |
| Ctrl+Shift+F | Open Search side bar |
| Ctrl+Alt+R | Reload window (Help menu); if any tab is dirty, you get one **in-app** confirm (no second browser unload prompt) |
| Ctrl+Shift+I | Toggle Developer Tools |
| Ctrl+= / Ctrl+- | Editor zoom in / out (when a tab is open) |
| Ctrl+0 | Reset editor zoom (main row or numpad) |

\* **Window-level shortcuts** (e.g. **Ctrl+S**, **Ctrl+W**, **Ctrl+B**, toggle chat/terminal, zoom) **and** **Ctrl+Q** / **Cmd+Q** / **Ctrl+Alt+R** are ignored when focus is in the **chat** mission field, the **terminal**, or Monaco’s **find/replace** bar, **quick input** (e.g. go to line), **suggestion** list, **parameter hints**, **inline rename**, **peek** (definition/references), **documentation hover**, or **editor context menu**—overlays keep keyboard priority, similar to VS Code.

---

## Step 5 — Run the Web App (optional)

```bash
pnpm dev:web
```

Opens at http://localhost:3000 — the landing page + web IDE.

---

## Step 6 — Use the CLI Agent (optional)

```bash
# Build first
cd apps/cli && pnpm build

# Run a mission
node dist/index.js run "Add a user authentication system" --path /path/to/your/project

# Or with multi-agent mode
node dist/index.js run "Build a REST API" --path . --multi-agent
```

---

## Project Structure (Quick Reference)

```
Auto-Coder/
├── apps/
│   ├── desktop/              ← Electron IDE (main app)
│   │   ├── electron/
│   │   │   ├── main.ts       ← Electron main process + IPC handlers
│   │   │   └── preload.ts    ← Bridge between UI and Electron
│   │   └── src/
│   │       ├── App.tsx       ← Root React component
│   │       ├── App.css       ← All IDE styles
│   │       └── components/
│   │           ├── Editor.tsx      ← Monaco editor wrapper
│   │           ├── ChatPanel.tsx   ← Agent chat interface
│   │           ├── FileTree.tsx    ← File explorer sidebar
│   │           ├── TerminalPanel.tsx ← xterm.js terminal
│   │           ├── StatusBar.tsx   ← Bottom status bar
│   │           ├── TopChrome.tsx   ← Cursor-style menus + title + Sign in
│   │           ├── MenuBar.tsx
│   │           └── ActivityBar.tsx
│   ├── web/                  ← Next.js 15 web IDE + landing page
│   │   └── app/
│   │       ├── page.tsx      ← Landing page
│   │       ├── layout.tsx    ← Root layout with Clerk auth
│   │       ├── globals.css   ← Web styles
│   │       └── api/agent/
│   │           └── route.ts  ← Streaming agent API endpoint
│   └── cli/
│       └── src/index.ts      ← Headless autonomous agent CLI
│
├── packages/
│   ├── ai-core/src/
│   │   ├── agent.ts          ← CORE: Autonomous agent loop
│   │   ├── orchestrator.ts   ← Multi-agent orchestration
│   │   ├── memory.ts         ← Per-project memory store
│   │   └── index.ts          ← Package exports
│   └── indexer/src/
│       └── index.ts          ← RAG codebase indexer
│
└── services/gateway/src/
    └── router.ts             ← AI model router with fallback
```

---

## Key Files to Customize First

1. **`packages/ai-core/src/agent.ts`** — Add more tools (browser control, git operations, etc.)
2. **`apps/desktop/src/components/ChatPanel.tsx`** — Customize the UI and quick missions
3. **`packages/indexer/src/index.ts`** — Swap simple chunker for tree-sitter AST parsing
4. **`apps/web/app/page.tsx`** — Update the landing page with your branding

---

## Cursor Tips for This Project

- In the editor, press **Ctrl+K** / **Cmd+K**, then **L** or **A** (chord—same family as VS Code) to open agent chat with a mission draft from the selection
- Use **Cursor Chat** (Ctrl+L) and say: *"Add a new tool to the agent in packages/ai-core/src/agent.ts that can search the web"*
- The `@auto-coder/ai-core` package is where all the intelligence lives — start there
- Run `pnpm typecheck` to check for TypeScript errors across the whole monorepo

---

## Recently added (baseline product)

1. **node-pty** terminal in the desktop app (`main.ts` + `TerminalPanel.tsx`)
2. **Web dashboard** at `apps/web/app/dashboard/page.tsx` with streaming `/api/agent`
3. **Clerk** sign-in/up routes and middleware protecting `/dashboard`
4. **CI** in `.github/workflows/ci.yml`
5. **Stripe webhooks** at `apps/web/app/api/stripe/webhook/route.ts` (signed, idempotent) → Clerk + subscription entitlements; see **README** and **`.env.example`**

## What to build next (scale-out)

1. **tree-sitter** in `packages/indexer` for AST-aware chunking
2. **LanceDB** (or similar) for vector RAG
3. **Stripe Checkout / Customer Portal** in the web UI (server routes that create sessions; webhooks already handle lifecycle)
4. **GitHub Action** agent workflow (e.g. `.github/workflows/agent.yml`)

---

## Need Help?

Describe what you want to add and iterate with your team’s tools — that’s the workflow this repo is built for.
