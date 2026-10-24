# Launchpad

**A shell-architecture alternative for hosting independent apps under one host.**

Unifying a frontend across teams typically means ***shell applications***, ***runtime injection***, or ***iframes***. None of these are ideal: they create coordination overhead between teams and introduce cross-app coupling — where a change in one application can break another.

Launchpad takes a different approach. Each app is deployed as its own self-contained bundle, served at its own URL under the same host. Apps share authentication, cookies, and platform services, but stay isolated from one another at runtime — different React versions, CSS resets, and state libraries never collide because they never share a window.

Launchpad is intentionally unopinionated: it will host any pre-built static bundle (React, Vue, Svelte, plain HTML, etc.). Pair it with your team's preferred component library and design system for visual consistency across deployed apps. Build locally, zip the output, POST it, and Launchpad serves at a shareable URL.

> For the why-this-exists pitch, see [docs/pitch-tech-leads.md](docs/pitch-tech-leads.md) (engineering audience) or [docs/pitch-exec.md](docs/pitch-exec.md) (executive audience). Operational concerns live in [docs/scaling.md](docs/scaling.md) and [docs/persistence.md](docs/persistence.md). For the deploy workflow, see [docs/skills.md](docs/skills.md) — Launchpad ships a `/launch` Claude skill that handles build, zip, and upload in one command.

## How it works

1. A developer builds an app locally (typically React + Vite, but any framework that produces static files works)
2. They zip the `dist/` (or equivalent build output) folder
3. They POST the zip to `/api/deploy` with metadata (team, name, description, creator)
4. Launchpad extracts the bundle and returns a shareable URL (e.g., `https://launchpad.example.com/apps/<team>/<app-name>`)
5. Stakeholders open the URL and interact with the live app

### Server APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Dashboard — lists all deployed apps with metadata |
| `POST` | `/api/deploy` | Deploy an app (multipart form: `file` zip, `folder`, `name`, `team`, `creator`, `description`) |
| `GET` | `/api/apps` | Returns JSON list of all deployed apps |
| `DELETE` | `/api/deploy/:folder` | Removes an app and its files |
| `GET` | `/apps/:team/:name` | Serves a deployed app (with SPA fallback) |

### Storage Architecture

Launchpad uses a file-based storage approach — no database required. This keeps the system simple, portable, and easy to back up.

**Metadata store** — `data/apps-meta/<team>/<slug>.json`, one file per deployed app. Each file tracks the app's display name, owning team, creator, description, deploy timestamps, and the URL path used to serve it. Writes are atomic (write to `.tmp.<random>`, then `rename`), which means concurrent deploys of different apps never contend on the same file and dashboard reads never see a partially-written record. See [docs/persistence.md](docs/persistence.md) for the design rationale.

```
data/apps-meta/
  marketing/
    landing-page.json
  growth/
    onboarding.json
```

Each file:

```json
{
  "folder": "marketing/landing-page",
  "name": "Q3 Launch Landing",
  "team": "marketing",
  "creator": "Jane Doe",
  "description": "Promotional landing page for the Q3 product launch",
  "createdAt": "2026-06-04T14:13:07.319Z",
  "updatedAt": "2026-06-04T14:13:07.319Z",
  "url": "/apps/marketing/landing-page/"
}
```

**Static file store** — `apps/` contains the actual app builds, organized by team and app name (e.g., `apps/marketing/landing-page/`). When a zip is uploaded, the server extracts it into the appropriate directory, automatically flattening single-folder archives (e.g., if the zip contains a `dist/` wrapper, the contents are promoted to the top level). Express serves these as static files with SPA fallback routing, so client-side navigation works out of the box.

Both directories are mounted as Docker volumes in production, ensuring app data persists across container restarts and redeployments. On hosts without persistent disks (Heroku), the optional bundle archive restores them on startup — see [Deploying to Heroku](#deploying-to-heroku).

### Deploying to Heroku

The repo deploys to Heroku with the standard Node.js buildpack. Heroku installs dependencies, runs `npm run build` (TypeScript → `dist/`), and starts the web dyno with `npm start` per the `Procfile`. The server binds to the `PORT` Heroku provides, and the Node version is pinned through `engines` in `package.json`.

```bash
heroku create <app-name>
heroku config:set DEPLOY_TOKEN=$(openssl rand -hex 32)
heroku config:set ARCHIVE_URL=https://inspiredeffect.com/launchpad.ashx ARCHIVE_TOKEN=<contents of the archive's token.txt>
git push heroku main
heroku open
```

**Deploy token:** when `DEPLOY_TOKEN` is set, `POST /api/deploy` and `DELETE /api/deploy/:folder` require `Authorization: Bearer <token>`; unauthenticated requests get `401`. Leave it unset for local development. Always set it on a publicly reachable instance — otherwise anyone can upload content to your domain or delete apps. The `/launch` skill sends the token from `LAUNCHPAD_DEPLOY_TOKEN`, and the dashboard prompts for it (once per browser session) when deleting an app.

**Persistent storage (bundle archive):** Heroku dynos have an ephemeral filesystem — `apps/` and `data/` are wiped whenever the dyno restarts (at least daily, and on every release). With `ARCHIVE_URL` and `ARCHIVE_TOKEN` set, Launchpad keeps a durable copy of every deployed zip and its metadata in the bundle archive (a single `launchpad.ashx` page on inspiredeffect.com, stored under its `App_Data/launchpad/`):

- **Deploy** extracts to a staging folder, uploads the zip to the archive, and only then swaps the new version live. If the archive upload fails, the deploy returns `502` and the previous version stays live.
- **Startup** binds `PORT` immediately, then restores any app that is missing or out of date (by sha256) from the archive, three at a time. Until restore finishes, requests for not-yet-restored apps get `503` with `Retry-After`, as do deploys and deletes.
- **Delete** removes the app from the archive first, then locally; if the archive is unreachable nothing is removed.

Without those variables Launchpad uses local storage only, exactly as before. See [docs/persistence.md](docs/persistence.md) for the design and the [setup runbook](docs/persistence.md#runbook-heroku-bundle-archive). Run a single dyno — dynos don't share a filesystem.

**Upload limit:** 100 MB by default, configurable with `MAX_UPLOAD_MB`. When the archive is enabled, the archive page is also bound by ASP.NET's default request limit of **4 MB** — larger deploys fail with a `502` naming the archive's `413`. Raising it needs a `maxRequestLength` setting on the inspiredeffect.com side ([how](docs/persistence.md#4-upload-size-the-4-mb-limit)).
