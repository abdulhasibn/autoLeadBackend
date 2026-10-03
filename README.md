# AutoLead Backend

Node.js + Express + TypeScript API for the AutoLead used-car brokerage platform (Supabase PostgreSQL + Auth). Clean Architecture feature modules under `src/features/*`. Normative spec: [docs/architecture.md](docs/architecture.md).

## Stack

- Node.js 22 LTS, TypeScript (strict, CommonJS)
- Express 5
- Supabase (`@supabase/supabase-js`) for PostgreSQL + Auth
- Zod for validation and startup config parsing
- Pino for structured logging
- Vitest + Supertest for testing
- Docker, GitHub Actions for build/CI

## Getting started

```bash
pnpm install
cp .env.example .env   # fill in your Supabase project URL/keys
pnpm dev                # starts the server with live reload (tsx watch)
```

Verify it's running:

```bash
curl http://localhost:3000/health
```

## Scripts

| Script                              | Purpose                                             |
| ----------------------------------- | --------------------------------------------------- |
| `pnpm dev`                          | Run the server with live reload                     |
| `pnpm build`                        | Compile TypeScript to `dist/`                       |
| `pnpm start`                        | Run the compiled server (`dist/app/http-server.js`) |
| `pnpm test`                         | Run the Vitest suite once                           |
| `pnpm test:watch`                   | Run Vitest in watch mode                            |
| `pnpm typecheck`                    | Type-check without emitting                         |
| `pnpm lint` / `pnpm lint:fix`       | ESLint                                              |
| `pnpm format` / `pnpm format:check` | Prettier                                            |

Git hooks (Husky, installed via `pnpm install` → `prepare`):

- **pre-commit** — `lint-staged` runs Prettier (and ESLint check) on staged files
- **pre-push** — `format:check`, `typecheck`, `lint`, and `test` (mirrors CI quality gates)

## Project structure

```text
src/
├── app/                 # composition root, HTTP server, route mounting
├── features/            # auth, vehicles, leads, … (added as capabilities land)
├── domain/errors/       # shared infra errors (NotFound, Conflict, …)
├── infrastructure/      # Supabase client, logger
├── presentation/http/   # Express middleware
├── shared/              # Result, Pagination, branded-id helper
└── config/              # Zod-validated startup config
```

Feature anatomy follows `docs/architecture.md` §7 (domain / application / infrastructure / presentation / composition).

## Environment variables

See [.env.example](.env.example). Configuration is parsed once at startup (`src/config/environment.ts`) with Zod and fails fast on missing/invalid values — application code must never read `process.env` directly.

## Docker

```bash
docker build -t autolead-backend .
docker run --env-file .env -p 3000:3000 autolead-backend
```

## Docs

| Doc                                                                               | Purpose                                              |
| --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [PRD.md](PRD.md)                                                                  | Product requirements (source of truth for behaviour) |
| [docs/PROGRESS.md](docs/PROGRESS.md)                                              | Current stage, area status, build log                |
| [docs/MVP_ROADMAP.md](docs/MVP_ROADMAP.md)                                        | MVP build order (stints 1–6)                         |
| [docs/api.md](docs/api.md)                                                        | Shipped APIs + how frontends should start            |
| [autoLeadBackend-postman](https://github.com/abdulhasibn/autoLeadBackend-postman) | Postman collection and local environment             |
| [docs/architecture.md](docs/architecture.md)                                      | Clean Architecture rules                             |
| [docs/schema.dbml](docs/schema.dbml)                                              | Database schema (design before migrations)           |
| [CONTEXT.md](CONTEXT.md)                                                          | Domain glossary                                      |

## Architecture

Read [docs/architecture.md](docs/architecture.md) before changing layers, modules, or dependency directions. ADRs under `docs/adr/` supersede where they conflict.
