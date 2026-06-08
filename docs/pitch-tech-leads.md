# Launchpad — Pitch (for tech leads)

## The problem with how we unify frontends today

Most ways of presenting multiple frontend apps under one product experience are not ideal. ***Shell applications***, ***runtime injection***, and ***iframes*** all deliver a unified UX, but they pay for it the same way: tight coordination between teams, a host-app contract that quietly breaks when one side changes, and a non-trivial risk that a change in one application impacts another.

We end up with ***cross-app coupling masquerading as cohesion.***

## A different spin on the shell concept

Launchpad sidesteps those tradeoffs entirely: **no shared runtime, no injection, no iframes.** Each app is deployed as its own self-contained bundle, served from its own route in the same host. Apps share cookies, auth, user context, and platform services, while remaining fully isolated from one another at runtime.

## Why this works better than injection or iframes

**Isolation is mostly free.** Each app is its own document at its own URL. Different React versions, CSS resets, state libraries, and dependencies don't collide because they never share a window.

**The integration surface is tiny.** The contract is: produce a folder of static files that works when served from a URL prefix. No SDK, no shim, no iframe boundary, no host-app contract that can quietly break under us.

**The server doesn't need to know React exists.** React, Vue, Svelte, Solid, even plain HTML all work the same way. Launchpad is accidentally framework-agnostic.

## Consistency, where it matters

Most apps should use the organization's shared component library and Tailwind-based design system. That's the default teams should reach for. But Launchpad does not technically require a specific UI framework or component library — apps that have a legitimate reason to use something else can, without the host needing to care.

That gives you a consistent customer experience where it creates value (shared design tokens, navigation patterns, accessibility standards, platform services), without forcing runtime coupling between apps.

A shared, **site-independent top nav component** can provide the same core functionality, API integration, user context, and platform features regardless of which app embeds it. That component — not the host — is what avoids the need for a traditional shell container.

## What this naturally supports

The same hosting model unlocks deployment patterns that are awkward in a shell architecture:

- **Independent release cadences.** Each app ships when it's ready.
- **Versioning and archiving.** Old versions stay reachable at a versioned slug.
- **Rollback.** Promote a previous bundle by re-pointing the slug.
- **Preview environments.** A PR can deploy to `/apps/<team>/<feature>-preview` for review.
- **Future-dated releases.** Stage a build today, activate it later.

None of these require new server code beyond what's already in place.

## How it works

1. A developer builds an app locally (typically React + Vite, but any framework that produces static files works)
2. They zip the `dist/` (or equivalent build output) folder
3. They POST the zip to `/api/deploy` with metadata (team, name, description, creator)
4. Launchpad extracts the bundle and returns a shareable URL (e.g., `https://launchpad.example.com/apps/<team>/<app-name>`)
5. Stakeholders open the URL and interact with the live app

Launchpad also ships a `/launch` Claude skill that handles build, zip, and upload in one command — see [docs/skills.md](./skills.md).

## Server APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Dashboard — lists all deployed apps with metadata |
| `POST` | `/api/deploy` | Deploy an app (multipart form: `file` zip, `folder`, `name`, `team`, `creator`, `description`) |
| `GET` | `/api/apps` | Returns JSON list of all deployed apps |
| `DELETE` | `/api/deploy/:folder` | Removes an app and its files |
| `GET` | `/apps/:team/:name` | Serves a deployed app (with SPA fallback) |

## Storage architecture

Launchpad uses a file-based storage approach — no database required. This keeps the system simple, portable, and easy to back up.

**Metadata store** — `data/apps-meta/<team>/<slug>.json`, one file per deployed app. Each file tracks the app's display name, owning team, creator, description, deploy timestamps, and the URL path used to serve it. Writes are atomic (write to `.tmp.<random>`, then `rename`), which means concurrent deploys of different apps never contend on the same file and dashboard reads never see a partially-written record. See [docs/persistence.md](./persistence.md) for the design rationale.

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

Both directories are mounted as Docker volumes in production, ensuring app data persists across container restarts and redeployments. See [docs/scaling.md](./scaling.md) for upload-size limits and [docs/persistence.md](./persistence.md) for the durability model.

## Core principle

> Applications remain independent by design, while the customer experience remains cohesive through shared standards, shared services, and shared platform capabilities.

This is the idea Launchpad is built around. Everything else is mechanics.
