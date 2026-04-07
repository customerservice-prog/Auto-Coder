# 🚀 Auto-Coder

> An autonomous AI-powered IDE that goes beyond Cursor. The AI plans, executes, tests, and self-heals — you just review.

## What is Auto-Coder?

Auto-Coder is a full-stack, launch-ready AI IDE built from scratch. It combines the best of Cursor IDE with next-generation autonomous coding capabilities: multi-agent orchestration, self-healing test suites, runtime instrumentation, and headless CI/CD agents.

## Features

### Core (Cursor Parity)
- Deep Codebase Indexing with RAG (LanceDB + tree-sitter AST)
- Composer / Multi-File Edit Mode with git-style diffs
- Predictive Autocomplete (ghost text, multi-line)
- Integrated Terminal (xterm.js + node-pty)
- Embedded Browser Panel with DevTools

### Advanced Auto-Coder Features
- Autonomous Debugging with Runtime Instrumentation
- Self-Healing Test Suites (auto-runs, auto-fixes)
- Multi-Agent Orchestration (parallel specialist agents on git worktrees)
- Multi-Model Evaluator/Judge (Claude vs GPT-4o vs DeepSeek)
- Visual Design-to-Code Mode
- PLAN.md Agentic Protocol (live agent thinking log)
- Headless / Long-Running Autonomous Mode
- CI/CD Native GitHub Action Agent
- Per-Project Memory and Context Store
- Performance Auditing Agent

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Shell | Electron + React 18 |
| Editor Core | Monaco Editor |
| Web Version | Next.js 15 App Router |
| Language | TypeScript throughout |
| AI Gateway | Vercel AI SDK |
| Primary Models | Claude 3.7 Sonnet, GPT-4o, DeepSeek |
| RAG | LanceDB + tree-sitter |
| Code Execution | E2B Sandbox API |
| Terminal | node-pty + xterm.js |
| Database | SQLite / Supabase |
| Auth | Clerk.dev |
| Payments | Stripe |
| Monorepo | Turborepo + pnpm |

## Project Structure

```
auto-coder/
├── apps/
│   ├── desktop/          # Electron + React IDE
│   ├── web/              # Next.js browser-based IDE
│   └── cli/              # Headless CLI agent
├── packages/
│   ├── ai-core/          # Agent orchestration engine
│   ├── indexer/          # RAG codebase indexing
│   ├── runtime/          # Sandboxed code execution
│   ├── multi-agent/      # Parallel agent workers
│   └── ui-kit/           # Shared components
├── services/
│   ├── gateway/          # AI model routing API
│   └── evaluator/        # Multi-model code judge
└── infra/                # Docker, K8s configs
```

## Getting Started

```bash
git clone https://github.com/customerservice-prog/Auto-Coder.git
cd Auto-Coder
npm install -g pnpm
pnpm install
cp .env.example .env
# Fill in your API keys in .env
pnpm dev:desktop
```

## Environment Variables

See `.env.example` for all required keys including:
ANTHROPIC_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY, SUPABASE_URL, CLERK_SECRET_KEY, STRIPE_SECRET_KEY, E2B_API_KEY

## License

MIT
