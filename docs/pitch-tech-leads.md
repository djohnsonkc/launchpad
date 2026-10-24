# Launchpad — For Engineers

## The problem with how we unify frontends today

Most ways of presenting multiple frontend apps under one product experience are not ideal. ***Shell applications***, ***runtime injection***, and ***iframes*** all deliver a unified UX, but they pay for it the same way: tight coordination between teams, a host-app contract that quietly breaks when one side changes, and a non-trivial risk that a change in one application impacts another.

We end up with ***cross-app coupling masquerading as cohesion.***

## A different spin on the shell concept

Launchpad sidesteps those tradeoffs entirely: **no shared runtime, no injection, no iframes.** Each app is deployed as its own self-contained bundle, served from its own route in the same host. Apps share cookies, auth, user context, and platform services, while remaining fully isolated from one another at runtime.

## Why this works better than injection or iframes

**Isolation is mostly free.** Each app is its own document at its own URL. Different React versions, CSS resets, state libraries, and dependencies don't collide because they never share a window.

**The integration surface is tiny.** The contract is: produce a folder of static files that works when served from a URL prefix. No SDK, no shim, no iframe boundary, no host-app contract that can quietly break under us.

**The server doesn't need to know React exists.** React, Vue, Svelte, Solid, even plain HTML all work the same way. Launchpad is accidentally framework-agnostic.

## Launchpad vs. Module Federation

Module Federation (webpack 5, Rspack, or Vite plugins) is the most common form of runtime injection. A *host* app loads JavaScript modules from separately deployed *remotes* at runtime and renders them inside its own page. Teams deploy independently, but everything runs in **one document**: one `window`, one React instance, one router.

Launchpad combines apps at the **page** level instead. Each app is its own document at its own URL; moving between apps is a normal page load. Apps share the domain (so cookies and auth carry over) and platform services, and nothing else.

| | Module Federation | Launchpad |
|---|---|---|
| Unit of composition | Components / modules | Whole apps (pages) |
| Multiple teams on one screen | Yes | No — one app per page |
| Moving between apps | Seamless in-app navigation | Full page load |
| Shared dependencies | Downloaded once, shared singletons | Each app ships its own |
| Version coupling | Shared libraries must stay compatible (e.g. matching React versions) | None — React 17, React 19, Vue, and plain HTML coexist |
| Build tooling | Federation-aware bundler and config in every app | Anything that outputs static files |
| Contract between teams | Exposed modules, props, and shared versions, all checked at runtime | A folder of static files that works under a URL prefix |
| Blast radius of a bad deploy | A broken remote can break the host page | Only that app |
| Local development | Usually needs the host and some remotes running | Each app runs on its own |

**Choose federation** when you genuinely need several teams' code on the same screen — a dashboard built from independently owned widgets, say — or when the whole product must behave as one seamless single-page app, and the teams can commit to coordinating shared library versions.

**Choose Launchpad** when each team owns a whole app or page, which describes most products and nearly all prototypes. You trade in-page composition and shared bundles for zero version coordination, any framework, and failures that stay contained.

The honest cost of Launchpad's model is cross-app UI such as a shared top nav. It comes from a component library every app builds in (simple, but an update means rebuilding each app) or a small script every app loads (no rebuilds, but a little runtime coupling). The site-independent top nav described below is where that tradeoff is made deliberately.

The two aren't mutually exclusive: a federation remote is just static files, so Launchpad can host federated apps. Page-level separation can be the default, with federation reserved for the one area that truly needs it.

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
