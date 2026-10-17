# Py — Workflow Builder

A pixel-perfect clone of the Galaxy.ai visual workflow builder for LLM pipelines. Signed-in users compose, connect, and execute node-based AI workflows on a canvas, then review run history.

**Stack:** Next.js 14 (App Router, TS) · React 18 · Tailwind · Prisma 5 (PostgreSQL) · Clerk v5 · `@xyflow/react` v12 · Zustand · Zod · Google Gemini · Trigger.dev v4.

## Prerequisites

- Node.js 20+
- A PostgreSQL database (e.g. Neon)

## Setup

```bash
npm install
cp .env.example .env   # then fill in the values (see below)
npm run prisma:generate
npm run prisma:push     # sync schema to your database
```

### Environment variables

Fill `.env` (copied from `.env.example`). The app runs in a **degraded/demo mode** when optional keys are missing.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL persistence (falls back to in-memory if unset) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Yes | Authentication (bypassed with a `demo-user` if unset) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Optional | Gemini LLM execution (mocked if unset) |
| `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF` | Optional | Trigger.dev task execution (inline fallback if unset) |
| `TRANSLOADIT_*` | Optional | Image upload/hosting + crop |

## Running locally

Start the two services in separate terminals:

```bash
# 1. Web app  -> http://localhost:3000
npm run dev

# 2. Trigger.dev worker (background tasks)
npx trigger.dev@latest dev --profile py-builder
```

Then open `http://localhost:3000`, go to `/dashboard`, click **Sample** to seed a workflow, and hit **Run**.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Generate Prisma client + production build |
| `npm start` | Run the production build |
| `npm test` | Run the unit test suite (Vitest) |
| `npm run lint` | Lint |
| `npm run typecheck` | Type-check (`tsc --noEmit`) |
| `npm run prisma:push` | Push Prisma schema to the database |
| `npm run db:seed` | Seed sample data |

## Project structure

- `app/` — routes: auth, dashboard, `workflow/[id]`, `api/*`
- `components/` — `canvas/*` and `dashboard/*` UI
- `lib/` — types, node registry, DAG, validation, Zustand store, execution engine, repository
- `trigger/` — Trigger.dev tasks (`crop-image`, `gemini-generate`)
- `prisma/` — `schema.prisma` + `seed.ts`
