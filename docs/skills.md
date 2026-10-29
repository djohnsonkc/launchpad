# Claude Skills

Launchpad ships Claude Code skills so teams can deploy apps with a single command instead of memorizing the `curl` form for `/api/deploy`. The skills are generalized — they operate on any team's app build, not a specific repo's layout.

## /launch

Deploys an app from a local build directory to Launchpad. Detects framework (Vite, CRA, Angular), applies sensible defaults, prompts for missing metadata, builds, zips, uploads, returns the deploy URL.

Source: [.claude/skills/launch/SKILL.md](../.claude/skills/launch/SKILL.md).

## Installing (for anyone deploying apps)

Launchpad serves the skill itself, so teams don't need this repo. The install page is `<launchpad-url>/skill` (production: https://launchpad.inspiredeffect.com/skill):

```bash
# macOS / Linux / Git Bash
curl -fsSL https://launchpad.inspiredeffect.com/skill/install.sh | sh
```

```powershell
# Windows PowerShell
irm https://launchpad.inspiredeffect.com/skill/install.ps1 | iex
```

Either writes one file, `~/.claude/skills/launch/SKILL.md`, making `/launch` available in every project. Re-running updates it.

**The right endpoint, automatically.** When serving `SKILL.md`, Launchpad replaces the skill's default server URL with its own origin ([src/routes/skill.ts](../src/routes/skill.ts)), so a skill installed from an instance always deploys back to that instance. `LAUNCHPAD_SERVER_URL` still overrides it.

**Deploy token.** The skill uses, in order: the `LAUNCHPAD_DEPLOY_TOKEN` environment variable; `LAUNCHPAD_DEPLOY_TOKEN` in this repo's `.env` when run from here (the owner's setup — one token, one place; see [deployment.md](./deployment.md#deploying-apps-to-production)); or `~/.launchpad/token` for installed copies. On a `401` it offers to save the token, so non-engineers never need to set environment variables.

## Read-only contract

`/launch` **never writes anything inside the target app's repository.** No source-file edits, no `.launchpad.json` cache file in the repo, no staging directories.

The framework's normal build (e.g., `vite build` writing to `dist/`) is fine — that's the framework's behavior, not the skill's, and those output dirs are typically gitignored by the user's existing setup. The skill just reads from the output dir.

The only files the skill ever writes:

1. A **temp zip** in `os.tmpdir()` — deleted in the cleanup step.
2. The **`~/.launchpad/apps.json`** cache in the user's home directory (not the target repo).
3. The **`~/.launchpad/token`** file, only if the user agrees to save a deploy token.

This contract protects the user's source tree from accidental churn or merge conflicts with parallel work in the same repo.

## How it's run

Once installed (or from inside this repo, where `.claude/skills/` provides it), invoke the skill against an app path anywhere on disk:

```
/launch ~/projects/my-app
```

The skill resolves the path, reads `package.json` (if present), and proceeds. Default Launchpad server URL: `https://launchpad.inspiredeffect.com` (the production instance, see [deployment.md](./deployment.md)), override via `LAUNCHPAD_SERVER_URL`.

## Framework detection

`/launch` reads `package.json` of the target app and picks a profile:

| Detected | Build command | Output dir | Base-path strategy |
|---|---|---|---|
| `vite` in deps OR `vite.config.*` exists | `npx vite build --base=/apps/<folder>/` | `dist/` | CLI flag override |
| `react-scripts` in deps | `PUBLIC_URL=/apps/<folder> npm run build` | `build/` | Env var override |
| `@angular/cli` in deps | `npm run build -- --base-href=/apps/<folder>/` | `dist/<project>/` | CLI flag override |
| `next` in deps | **not supported** — Next isn't a pure static target | — | — |
| None of the above, or no `package.json` | (none — manual mode) | (prompt) | (warning only) |

Detection is best-effort. If multiple match, prefer the more specific one. If none match, fall through to the manual prompt.

## Base-path correctness — CLI overrides, never source edits

The single most common deploy footgun is asset URLs baked in for the wrong base path (e.g., a Vite app with `base: '/'` served at `/apps/<team>/<app>/`). Every framework with a build step exposes a way to override the base at build time without touching the config file:

- **Vite:** `--base=<path>` CLI flag wins over `vite.config.*`'s `base`.
- **CRA:** the `PUBLIC_URL` environment variable wins over `package.json`'s `homepage`.
- **Angular:** the `--base-href` CLI flag wins over `angular.json`.

`/launch` uses these overrides automatically. The user's config file is read for context but never modified.

**Manual mode (static sites with hardcoded paths)** has no equivalent escape hatch. The skill scans for likely problem patterns (`href="/foo"`, `src="/foo"`, `url(/foo)`, etc.) and warns the user with the message that they need to fix the paths *in their own source* if they want assets to resolve correctly under the deploy slug. The skill will not edit those files.

## The cache: `~/.launchpad/apps.json`

A single JSON file in the user's home directory caches deploy metadata, keyed by absolute app path:

```json
{
  "/home/jane/projects/landing-page": {
    "team": "marketing",
    "name": "Q3 Launch Landing",
    "folder": "marketing/landing-page",
    "description": "Promotional landing page for the Q3 product launch",
    "framework": "vite",
    "buildCommand": "npm run build",
    "buildDir": "dist",
    "includePatterns": null
  },
  "/home/jane/projects/docs-site": {
    "team": "docs",
    "name": "Documentation Site",
    "folder": "docs/site",
    "description": "Hand-written HTML documentation",
    "framework": "manual",
    "buildCommand": null,
    "buildDir": null,
    "includePatterns": ["index.html", "manifest.json", "*.svg", "*.png"]
  }
}
```

Subsequent `/launch` runs against the same app path read this and skip the prompts. The cache is **per-user-per-machine**, not shared via the target repo, which matches the read-only contract above.
