# Auto-Coder

> An autonomous AI-powered IDE: desktop Electron shell, web assistant, and CLI — with agent loops, project memory, and optional multi-agent orchestration.

## What ships today

| Surface | What it does |
|--------|----------------|
| **Desktop** (`apps/desktop`) | Monaco editor, file tree, chat-driven `runAgent` (writes `PLAN.md` + files), in-memory indexer search, **real terminal** (xterm + node-pty). |
| **Web** (`apps/web`) | Landing, **Clerk** auth, **`/dashboard`** streaming assistant (`POST /api/agent`), verified **Stripe webhooks** (Clerk metadata + subscription entitlements; optional **`AGENT_API_REQUIRES_PRO`** on `/api/agent`). |
| **CLI** (`apps/cli`) | Headless `runAgent` / `orchestrate` against a project path. |
| **Packages** | `@auto-coder/ai-core` (agent + memory + orchestrator), `@auto-coder/indexer` (chunk + keyword search; in-memory cache). |
| **Gateway** (`services/gateway`) | Library-style model router (`selectModel`, `routeCompletion`) for reuse — not a deployed HTTP service yet. |

## Roadmap / not in-repo yet

LanceDB + tree-sitter RAG, E2B sandboxes, embedded browser panel, in-app Stripe Checkout / Customer Portal flows, GitHub App agent workflow, dedicated `infra/` and `packages/runtime` — see [SETUP.md](./SETUP.md) for extension points.

## Tech stack

Electron + React + Monaco, Next.js 15 App Router, Turborepo + pnpm, Vercel AI SDK, Clerk, node-pty + xterm.

## Project structure (actual)

```
Auto-Coder/
├── apps/desktop, web, cli
├── packages/ai-core, packages/indexer
├── services/gateway
└── .github/workflows/ci.yml
```

## Getting started

```bash
git clone <your-private-repo-url>
cd Auto-Coder
corepack enable && corepack prepare pnpm@9.0.0 --activate
pnpm install
cp .env.example .env
# Min desktop: ANTHROPIC_API_KEY (or OpenAI / DeepSeek per agent model)
# Min web: NEXT_PUBLIC_CLERK_* and CLERK_SECRET_KEY
pnpm build
pnpm dev:desktop
# or
pnpm dev:web
```

`pnpm dev` tasks build workspace dependencies first (`turbo` `dev` → `^build`).

**Desktop (`pnpm dev:desktop`):** optional **`VITE_WEB_SIGN_IN_URL`** (e.g. `https://your-app/sign-in`) — default is `http://localhost:3000/sign-in`. The **Sign in** control and **Help → Sign in to Auto-Coder Web** menu open this URL in the system browser (Clerk on the web app).

## Environment variables

See [.env.example](./.env.example). **Web:** Clerk keys + model provider keys for `/api/agent`. **Desktop/CLI:** provider keys for the agent. **Stripe / Supabase / E2B** are optional until you wire those features.

**`/api/agent` abuse controls:** `AGENT_API_WINDOW_MS`, `AGENT_API_MAX_PER_WINDOW` (sliding window per user), and optional `AGENT_API_DAILY_MAX` (UTC day). Without **Upstash**, limits are in-process only. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to share limits across serverless/web instances. The route also enforces a **512 KiB** streaming cap on the raw JSON body (**413** if exceeded) and a **100,000**-character max on `projectContext` (see `apps/web/lib/agent-api-limits.ts`).

**Legal (web):** Starter **`/privacy`** and **`/terms`** pages are placeholders — replace with counsel-approved copy before a real launch.

## Stripe (web)

Hosted **Checkout** (`POST /api/stripe/checkout`) and **Customer Portal** (`POST /api/stripe/portal`) need the Stripe secrets and price IDs documented in [.env.example](./.env.example). Operational checklist:

1. **Webhook URL:** `https://<your-domain>/api/stripe/webhook` (local dev only if you tunnel to Stripe, e.g. Stripe CLI or ngrok).
2. **Signing secret:** set `STRIPE_WEBHOOK_SECRET` to the endpoint’s `whsec_…` value.
3. **Payload size:** the handler reads the body with a **1 MiB** streaming cap (Stripe’s documented maximum) and responds with **413** if exceeded — limits abuse without buffering huge payloads.
4. **Event types** — in Stripe Dashboard → Developers → Webhooks, select **at least** these (they map to `dispatchStripeEvent` in `apps/web/lib/stripe-webhook-dispatch.ts`):
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. **Clerk ↔ Stripe:** Checkout must pass the Clerk user id as `client_reference_id` or `metadata.clerk_user_id` (`user_…`). **`checkout.session.async_payment_succeeded`** is handled like **`checkout.session.completed`** so delayed-success payments still sync. Subscription webhooks resolve the user from **`customer.metadata.clerk_user_id`**, or from **`subscription.metadata.clerk_user_id`** with a best-effort mirror onto the customer after checkout.
6. **Optional tax:** after Stripe Tax is configured on products/prices, set `STRIPE_CHECKOUT_AUTOMATIC_TAX=1` for automatic tax, required billing address, and tax ID collection on Checkout.

## CI

GitHub Actions runs `pnpm install`, `typecheck`, `test`, and `build` on push/PR (placeholder Clerk env vars for Next build).

**Health check:** `GET /api/health` returns `{ ok, service, time }` with **`X-Request-Id`** and **`Cache-Control: no-store`**, optionally **`revision`** (short git SHA on Vercel via `VERCEL_GIT_COMMIT_SHA`, else `npm_package_version` when set). **`?checks=1`** adds **`checks`** booleans (Clerk publishable + **`clerkSecret`** (`CLERK_SECRET_KEY`), **`publicAppUrl`**, Stripe webhook/API, checkout prices, **`stripeClerkSync`**, billing rate limit, **`agentRequiresPro`**, **`agentLlmKeys`** (any of Anthropic/OpenAI/DeepSeek), Upstash) — no secret values.

**SEO:** `robots.txt` and `sitemap.xml` are generated from `app/robots.ts` and `app/sitemap.ts`. Set **`NEXT_PUBLIC_APP_URL`** to your canonical HTTPS origin in production so URLs are correct.

**`/api/agent` observability:** responses include **`X-Request-Id`** (also echoed in JSON error bodies). Logs are one JSON line per event (`request_accepted`, `stream_complete`, `quota_exceeded`, etc.) for log drains. Set **`AGENT_API_DEBUG=true`** to append **`clerkSessionId`** / **`clerkOrgId`** / **`clerkOrgRole`** to those lines (staging-friendly; treat logs as sensitive).

**Stripe:** See **[Stripe (web)](#stripe-web)** for webhook URLs, signing secret, and required event types. **`POST /api/stripe/checkout`** (Clerk session + price env) returns a hosted Checkout **`url`**. **`POST /api/stripe/portal`** requires **`privateMetadata.stripeCustomerId`** (configure Customer Portal in Dashboard → Billing). Checkout and portal use the same in-process billing rate limit (**`BILLING_API_*`**; **`0`** disables). **`POST /api/stripe/webhook`** verifies signatures and dedupes by event id (Upstash **`SET NX`** or in-memory). With **`STRIPE_SYNC_CLERK_METADATA`** on (default), checkout + subscription handlers update Clerk **`privateMetadata`** / entitlement **`publicMetadata`** (**`stripeEntitlementTier`** **pro** for **`active`**, **`trialing`**, **`past_due`**); invoice events store a last-invoice snapshot. Set **`AGENT_API_REQUIRES_PRO`** so **`POST /api/agent`** is **403** unless **`publicMetadata.stripeEntitlementTier`** is **pro**.

**Vercel (pnpm monorepo):** set the project **Root Directory** to `apps/web`, **Install** to `cd ../.. && pnpm install`, and **Build** to `cd ../.. && pnpm exec turbo run build --filter=web` (or build from repo root with the same filter). See `apps/web/vercel.json` for the Next.js framework hint.

## License

Proprietary — this codebase is not offered as public open source. Use is governed by your agreement with the project owner.
