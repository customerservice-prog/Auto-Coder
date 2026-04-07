# 🚀 Auto-Coder — Setup Guide

> Open this in Cursor and you're ready to build. Follow these steps exactly.

---

## Step 1 — Clone & Open in Cursor

```bash
git clone https://github.com/customerservice-prog/Auto-Coder.git
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
│   │           └── TitleBar.tsx    ← Top title bar
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

- Press **Ctrl+K** anywhere in the editor to use inline AI edits
- Use **Cursor Chat** (Ctrl+L) and say: *"Add a new tool to the agent in packages/ai-core/src/agent.ts that can search the web"*
- The `@auto-coder/ai-core` package is where all the intelligence lives — start there
- Run `pnpm typecheck` to check for TypeScript errors across the whole monorepo

---

## What to Build Next (Priority Order)

1. **Wire up node-pty** in `apps/desktop/electron/main.ts` for a real interactive terminal
2. **Add tree-sitter** to `packages/indexer/src/index.ts` for AST-aware chunking
3. **Add LanceDB** to `packages/indexer` for real vector similarity search
4. **Build the dashboard page** at `apps/web/app/dashboard/page.tsx`
5. **Add Stripe webhooks** in `apps/web/app/api/stripe/webhook/route.ts`
6. **Wire up the GitHub Action** in `.github/workflows/agent.yml`

---

## Need Help?

Open an issue on GitHub or ask Cursor to help — just describe what you want to add and let the agent build it for you. That's the whole point. 🚀
