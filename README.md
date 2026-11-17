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

| Variable                | App     | Default                     | Purpose                                                    |
| ----------------------- | ------- | --------------------------- | ---------------------------------------------------------- |
| `ADMIN_ORIGIN`          | api     | `http://localhost:5174`     | Admin origin allowed by CORS                               |
| `CF_ACCESS_TEAM_DOMAIN` | api     | unset                       | Zero Trust team domain, e.g. `myteam.cloudflareaccess.com` |
| `CF_ACCESS_AUD`         | api     | unset                       | AUD tag of the Access application in front of the API      |
| `VITE_API_BASE_URL`     | website | `http://localhost:5173`     | API location, injected by CI in production                 |
| `VITE_SITE_URL`         | website | `http://localhost:4321`     | Site URL for canonical links and sitemap                   |
| `VITE_API_BASE_URL`     | admin   | empty (uses the Vite proxy) | Production gets the deployed API Worker URL from CI        |

**`apps/api` may only contain `.env`.** Void's `void/env` refuses to start when it finds both `.env` and `.env.example`, so this app has no example file; the variables are typed in `apps/api/env.ts`.

### Admin authentication

`/api/admin/*` verifies the Cloudflare Access JWT (`Cf-Access-Jwt-Assertion`) inside the Worker, so the admin API is protected even if an Access policy is scoped to the wrong hostname or the Worker is called directly.

- With both variables unset in local development, the guard logs one warning and lets requests through, so `vp run dev:admin` works without a Zero Trust setup.
- In production both are required. If they are missing the admin API fails closed with a 500, and requests without a valid token get a 401.
- To find the AUD tag: Zero Trust dashboard → Access → Applications → your application → Overview → Application Audience (AUD) Tag.

## Public API and rendered content

- `GET /api/posts` returns the fields a list page needs (`description`, `category`, `tags`) alongside the post metadata.
- `GET /api/feed` returns every published post with its body. RSS and the blog pages' `getStaticPaths` use it, which keeps the site build at a constant number of API requests instead of one per post.
- Markdown is rendered by `packages/shared`, and raw HTML inside a post is **escaped rather than rendered**: only `br`, `kbd`, `mark`, `sub`, `sup`, `small`, `del` and `ins` survive, and always without attributes. Links and images whose protocol is not `http(s)`, `mailto` or `tel` are dropped. Both rules exist because the site injects the HTML with `set:html` and the admin preview writes it into a same-origin window.

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

The website is static, so a post published from the admin UI only reaches it after a rebuild. That is why the workflow also runs on a daily schedule (04:00 Asia/Shanghai) that rebuilds the site alone — the API and admin are untouched because the build reads the live API. To publish sooner, run the workflow manually with `app: website`.
