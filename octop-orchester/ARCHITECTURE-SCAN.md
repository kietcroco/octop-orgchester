# Architecture scan: Orchester vs Octop

Scope: `orchester/` (lucasmailland/orchester) and `octop/` (TencentCloud/Octop), both read from the shallow submodule checkouts at `d76c006` and `890111b`. Sources: each repo's `AGENTS.md`, `docs/ARCHITECTURE.md` (Orchester) and `docs/architecture.md` (Octop), plus the directory layout and manifests. Code paths were spot-checked, not fully audited.

## 1. Snapshot

| | Orchester | Octop |
|---|---|---|
| Purpose | Platform for building AI agents and orchestrating them in workflows (multi-tenant) | Self-hosted AI assistant, multi-user, multi-agent |
| Language / runtime | TypeScript, Node >= 20, pnpm + Turborepo | Python 3.12+, uv; React 18 + TypeScript dashboard |
| Backend | Next.js 15 App Router (API, SSE, MCP server, UI in one app) | FastAPI + uvicorn, Click CLI |
| Frontend | Next.js "Studio" (HeroUI), separate `apps/widget` bundle | Vite SPA in `dashboard/`, built into the wheel |
| Database | Postgres 15+ with Drizzle; pg-boss job queue; RLS | SQLite (WAL) by default, or PostgreSQL via psycopg |
| Memory | Separate Mnemosyne HTTP service (own Postgres + pgvector), via `@mnemo-ai/client-ts` | In-process memory (`octop-memory`) |
| Workers | Worker process = same bundle in another mode | No separate worker; APScheduler in-process |
| Deployment | Docker Compose, Caddy, Railway | Single wheel, Docker image, desktop and fnOS packaging |
| Size (source files) | ~828 TS/TSX under `apps/web` | ~706 `.py` under `src/octop`, ~489 `.tsx` in dashboard |

## 2. Shape of each system

**Orchester** is a web platform. One Next.js app holds the Studio UI, REST API, SSE, and an MCP server. Two independent services sit next to it:
- Application DB (users, workspaces, flows, conversations, agents, KB).
- Mnemosyne, a memory service with its own Postgres. Orchester talks to it only over HTTP through an SDK.

Request handling goes edge middleware, then route handler, then `withTenantContext`, then the quota/spend gate, then the flow runner. Tenant isolation is enforced in the database with RLS.

**Octop** is one Python process. `OctopServer.start()` in `infra/server.py` is the composition root, and `launch.py` is the only module that imports both `infra/server` and `api/app`. Layering is strict:
- `api/` (FastAPI) and `cli/` call into `infra/`.
- `infra/` must not import `api/`, `cli/`, or `launch.py`.
- `dashboard/` talks to the backend only over HTTP.

Octop's own `AGENTS.md` lists these as hard bans and they are the most important structural rule in that repo.

## 3. Comparison of the things that matter for merging features

| Concern | Orchester | Octop | Implication |
|---|---|---|---|
| Multi-tenancy | Tenant context + Postgres RLS | Per-user rows (`agents.user_id`), JWT, admin bypass | Orchester's model is stronger on isolation. Porting tenancy into Octop would touch the DB layer. |
| Agent definition | Agents in a workspace, orchestrated by flows | Agents with personas, experts, teams, skills, cron | Octop already has agent-to-agent pieces (teams, delegation). Orchester's flow model is the main missing piece. |
| Workflows / flows | Core feature (flows run via `/api/flows/:id/run` and the worker) | Not a first-class concept; cron + triggers only | Largest gap. Likely new `infra/flows/` plus a runner. |
| Memory | External Mnemosyne service | In-process octop-memory | Choose one: call Mnemosyne over HTTP, or keep in-process. |
| Background jobs | pg-boss queue, separate worker mode | APScheduler in the same process | Flows with retries need a queue. APScheduler alone may not be enough. |
| Realtime | SSE + MCP | WebSocket for chat, SSE only for HITL resume | Both are workable. |
| Connectors / integrations | MCP client (`docs/MCP_CLIENT.md`), 80+ AI providers | Connector catalog, OAuth, MCP gateway, IM channel gateway | Both have MCP. Octop has a built-in IM channel gateway; Orchester's equivalent was not checked. |
| Deploy | Compose + Caddy + Railway | Compose, desktop, fnOS, single wheel | `octop-orchester/docker-compose.yml` should eventually add the services Orchester needs (Postgres, Mnemosyne, Redis if used). |

## 4. Risks and open questions

1. **Two databases in the target.** Octop defaults to SQLite and supports Postgres. Orchester requires Postgres with RLS. A combined product needs one answer for which DB is the source of truth. Recommend Postgres for the combined build.
2. **Two runtimes in one process.** Octop is Python and Orchester is TypeScript. Merging means either a Python port of the flow runner, or running Orchester as a sidecar service and calling it over HTTP. The sidecar is far less work and is the lower-risk path.
3. **Mnemosyne.** Orchester's `docs/ARCHITECTURE.md` describes Mnemosyne as a sibling repo, but the submodule was removed in `pnpm-workspace.yaml`. Confirm the intended memory backend before designing around it.
4. **Licenses.** Orchester is Apache-2.0 and Octop is MIT. Both are permissive, but attribution and NOTICE handling need a check before shipping a combined image.
5. **Secrets policy.** Orchester's `AGENTS.md` forbids committed secrets and requires gitleaks on commit. Any code copied from it into `octop-orchester/` must follow the same rule.

## 5. Suggested next steps

1. Decide on the target: Octop as the host with Orchester features added, or Orchester as the host with Octop's agent features. The answer decides which repo's architecture wins.
2. If Octop is the host, prototype the flow runner as a new `infra/flows/` package with its own repo layer, and keep it out of `api/` per Octop's module rules.
3. Add a sidecar service for anything that is hard to port (Orchester's web UI, or Mnemosyne), and wire it in `docker-compose.yml`.
4. Re-run this scan after any change to either submodule's pinned commit.
