# launchpad

Static portal and marketing site for Launchpad — deployed to **GitHub Pages** at `https://djohnsonkc.github.io/launchpad/`. TypeScript build script renders all pages at build time; no server required. The app catalog lives in `apps.json`.

## Hosting (GitHub Pages)

Push to `main` triggers `.github/workflows/deploy.yml`, which runs `npm run build` and uploads `dist/` to GitHub Pages. GitHub Pages must be set to **GitHub Actions** as the source under repo Settings → Pages. No custom domain — served at the `/launchpad/` subpath.

**Base path rule:** Every absolute URL in generated HTML must be prefixed with `/launchpad`. This is enforced through `src/lib/base.ts` — always use `url('/some/path')` rather than `'/some/path'` directly. Forgetting this is what always broke previous deployments.

## Commands

```bash
npm run dev      # build once, then watch src/ + docs/ + apps.json and serve at http://localhost:3000/launchpad/
npm run build    # render all pages to dist/
npm run typecheck
```

## How it works

`npm run build` runs `src/build.ts`, which:
1. Reads `apps.json` → passes to `renderDashboard()` for `dist/index.html`
2. Renders `docs/pitch-*.md` via `marked` → `dist/pitch/<slug>/index.html`
3. Renders the `/launch` skill install page → `dist/skill/index.html`
4. Copies `public/` assets (rocket.svg etc.) to `dist/`

## Structure

| File | Purpose |
|---|---|
| `src/build.ts` | Build entry point — generates all pages into `dist/` |
| `src/lib/base.ts` | `BASE` constant + `url()` helper; set `BASE_PATH` env var to override |
| `src/lib/store.ts` | `AppMeta` interface (type only — no filesystem I/O) |
| `src/views/layout.ts` | Shared HTML shell, nav, theme toggle |
| `src/views/dashboard.ts` | Home page — renders app grid/list from `AppMeta[]` |
| `src/views/page.ts` | Markdown page renderer (pitch pages) |
| `apps.json` | Static app catalog — array of `AppMeta` objects |
| `docs/pitch-*.md` | Pitch page content (product, tech-leads, exec) |
| `.claude/skills/launch/SKILL.md` | The `/launch` deploy skill (copied to `dist/skill/`) |

## Adding an app

Add an entry to `apps.json`:

```json
[
  {
    "folder": "team/app-slug",
    "name": "Display Name",
    "team": "Team Name",
    "creator": "Jane Doe",
    "description": "One-line description.",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "url": "https://djohnsonkc.github.io/app-slug/"
  }
]
```

The `url` field is what the dashboard card links to — it should point to wherever the app is actually hosted (another GitHub Pages repo, Heroku, etc.). Commit `apps.json` to deploy the change.

## Deploy API (future)

The old `POST /api/deploy` endpoint that accepted zip uploads is gone with the GitHub Pages migration. The plan is to run a lightweight API server separately; the `/launch` skill reads `LAUNCHPAD_SERVER_URL` and will point at it once it's up.
