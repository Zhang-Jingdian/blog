# Blog System

A single repository for a personal blog: one API, one admin console, one static site, plus a package the two frontends share.

## Layout

| Path              | Responsibility                                                        | Stack                                    |
| ----------------- | --------------------------------------------------------------------- | ---------------------------------------- |
| `apps/api`        | Public API (posts / categories / tags / files) and admin API          | Hono + Drizzle + Cloudflare D1/R2 + Void |
| `apps/admin`      | Post, category, tag and media management                              | Vue 3 + Vite                             |
| `apps/website`    | Public site, pulls data from the API at build time                    | Astro (static output)                    |
| `packages/shared` | Shared by both frontends: markdown rendering, response envelope types | TypeScript, consumed from source         |

Tests live next to the app they cover (`apps/*/test`, `packages/*/test`) and run through the root `vitest.config.ts`, so an assertion is always one directory away from the endpoint it describes.

## Getting started

```bash
vp install   # install dependencies and link workspace packages
vp run dev   # start api → admin → website, in that order
```

Each service starts only after the previous port is actually listening, so the admin proxy and the website's server-side fetches never hit a dead port. Log lines are prefixed with the service name, a single Ctrl+C stops everything, and a port already in use aborts the run instead of letting Vite silently pick another one (which would break the proxy and the CORS allowlist).

| App            | Port | URL                                            |
| -------------- | ---- | ---------------------------------------------- |
| `apps/api`     | 5173 | http://localhost:5173                          |
| `apps/admin`   | 5174 | http://localhost:5174 (proxies `/api` to 5173) |
| `apps/website` | 4321 | http://localhost:4321                          |

To start a single app:

```bash
vp run dev:api
vp run dev:admin
vp run dev:website
```

## Commands

| Command           | What it does                                                         |
| ----------------- | -------------------------------------------------------------------- |
| `vp run dev`      | Start every app in dependency order                                  |
| `vp check`        | Format, lint and type check                                          |
| `vp test`         | Run all tests (`vp test run` exits after one pass)                   |
| `vp run -r build` | Build the three apps                                                 |
| `vp run ready`    | Pre-commit self-check: format, lint, types and tests (works offline) |

Inside `vp run -r build`, **the website build needs the API to be running** — `getStaticPaths` fetches every post. That is why it is not part of `ready`. Offline, start the API first with `vp run dev:api`, or build a single app with `vp run api#build`.

## Environment variables

| Variable            | App     | Default                     | Purpose                                             |
| ------------------- | ------- | --------------------------- | --------------------------------------------------- |
| `ADMIN_ORIGIN`      | api     | `http://localhost:5174`     | Admin origin allowed by CORS                        |
| `VITE_API_BASE_URL` | website | `http://localhost:5173`     | API location, injected by CI in production          |
| `VITE_SITE_URL`     | website | `http://localhost:4321`     | Site URL for canonical links and sitemap            |
| `VITE_API_BASE_URL` | admin   | empty (uses the Vite proxy) | Production gets the deployed API Worker URL from CI |

**`apps/api` may only contain `.env`.** Void's `void/env` refuses to start when it finds both `.env` and `.env.example`, so this app has no example file; the variables are typed in `apps/api/env.ts`.

## `apps/api` directory conventions

```
routes/      file path is the URL (routes/api/posts/[slug].ts → /api/posts/:slug)
middleware/  execute in filename order, using the numeric prefix
db/          Drizzle schema and migrations
src/lib/     business logic (validation, slugs, uploads, export, …)
```

The first three are Void framework conventions rather than arbitrary choices — read `node_modules/void/docs/` before moving anything. Only `src/lib/` is free to reorganize.

## Deployment

`.github/workflows/deploy.yml` deploys each app to Cloudflare separately; `ci.yml` runs `vp check` and `vp test` on pull requests.
