# Launchpad — Pitch (for tech leads)

There may be a simple way for us to deploy net-new applications in the same host while keeping each app fully independent. Different spin on the shell concept — no injection, no iframes.

## The idea

Each app is deployed as its own self-contained bundle, served from its own route in the same host. Apps share cookies, auth, user context, and common platform services, while remaining isolated from one another at runtime.

The [Prototype Viewer](https://proto-viewer.rosnetdev.com/) is already a good model. It's an unopinionated host that accepts a zip file, unpacks it, and serves the app from its own route. Launchpad applies the same pattern to net-new production applications.

## Why this could be better than injection or iframes

**Isolation is mostly free.** Each app is its own document at its own URL. Different React versions, CSS resets, state libraries, and dependencies don't collide because they never share a window.

**The integration surface is tiny.** The contract is: produce a folder of static files that works when served from a URL prefix. No SDK, no shim, no iframe boundary, no host-app contract that can quietly break under us.

**The server doesn't need to know React exists.** React, Vue, Svelte, Solid, even plain HTML all work the same way. Launchpad is accidentally framework-agnostic.

## Consistency, where it matters

Most net-new apps should use Rosnet UI and our Tailwind-based design system. That's the default Rosnet teams should reach for. But Launchpad does not technically require a specific UI framework or component library — apps that have a legitimate reason to use something else can, without the host needing to care.

That gives us a consistent customer experience where it creates value (shared design tokens, navigation patterns, accessibility standards, platform services), without forcing runtime coupling between apps.

A shared, **site-independent top nav component** can provide the same core functionality, API integration, user context, and platform features regardless of which app embeds it. That component — not the host — is what avoids the need for a traditional shell container.

## What this naturally supports

The same hosting model unlocks deployment patterns that are awkward in a shell architecture:

- **Independent release cadences.** Each app ships when it's ready.
- **Versioning and archiving.** Old versions stay reachable at a versioned slug.
- **Rollback.** Promote a previous bundle by re-pointing the slug.
- **Preview environments.** A PR can deploy to `/apps/<team>/<feature>-preview` for review.
- **Future-dated releases.** Stage a build today, activate it later.

None of these require new server code beyond what's already in place.

## Core principle

> Applications remain independent by design, while the customer experience remains cohesive through shared standards, shared services, and shared platform capabilities.

This is the idea Launchpad is built around. Everything else is mechanics.
