# Claude Skills

Launchpad ships Claude Code skills so teams can deploy apps with a single command instead of memorizing the `curl` form for `/api/deploy`. Same idea as the [proto-share](https://github.com/RosnetDev/rosnet-product-prototypes) skill, but generalized — operates on any team's app build, not a specific repo's layout.

## /launch

Deploys an app from a local build directory to Launchpad. Detects framework (Vite, CRA, Angular), applies sensible defaults, prompts for missing metadata, builds, zips, uploads, returns the deploy URL.

Lives at [.claude/skills/launch/skill.md](../.claude/skills/launch/skill.md).

## How it's run

Skills live in `.claude/skills/` inside this repo. Engineers clone Launchpad, `cd` into it, and invoke the skill against an app path elsewhere on disk:

```
/launch ~/projects/my-app
```

The skill resolves the path, reads `package.json`, and proceeds. Default Launchpad server URL: `https://launchpad.rosnetdev.com`, override via `LAUNCHPAD_SERVER_URL`.

## Framework detection

`/launch` reads `package.json` of the target app and picks a profile:

| Detected | Build command (default) | Output dir (default) | Base-path config |
|---|---|---|---|
| `vite` in deps OR `vite.config.*` exists | `npm run build` | `dist/` | `base` in `vite.config.*` |
| `react-scripts` in deps | `npm run build` | `build/` | `homepage` in `package.json` |
| `@angular/cli` in deps | `npm run build` | `dist/<project>/` | `--base-href` build flag |
| `next` in deps | **not supported** — Next isn't a pure static target | — | — |
| None of the above | Prompt user | Prompt user | None |

Detection is best-effort. If multiple match, prefer the more specific one. If none match, fall through to the manual prompt.

## The Vite base-path guard rail

The single most common Launchpad deploy footgun is Vite apps shipped with `base: '/'` when they need `base: '/apps/<team>/<app>/'`. Without the right `base`, every asset URL 404s and the app appears broken even though it's served correctly.

`/launch` runs a Vite-specific check before building:

1. Read `vite.config.ts` (or `.js`).
2. Compare the configured `base` against the resolved deploy slug `/apps/<folder>/`.
3. If mismatched, show the diff to the user and ask to fix:

   > Your `base` is `'/'`. For deploys to `/apps/ux/scheduling/` it needs to be `'/apps/ux/scheduling/'`. Update vite.config.ts? **[Y/n]**

4. On confirm, edit the file, then build.

**Opt-in, never silent.** Config files are user surface — we ask before writing.

Equivalent checks exist for the other framework profiles:

- **CRA** — checks `"homepage"` in `package.json`.
- **Angular** — checks `--base-href` flag.
- **Manual mode** — skips the check; user is on their own (and that's a fair tradeoff for opting out).

## The `.launchpad.json` convention

On first deploy, `/launch` writes a small config file into the target app's repo:

```json
{
  "team": "ux",
  "name": "Scheduling Workflow",
  "folder": "ux/scheduling",
  "description": "Progressive scheduling flow for managers",
  "buildDir": "./dist",
  "buildCommand": "npm run build",
  "framework": "vite"
}
```

Subsequent `/launch` runs read it and skip the prompts. Teams can `.gitignore` it (personal preference) or commit it (shared team setup) — either works.
