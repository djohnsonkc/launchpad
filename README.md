# Launchpad

**A portal for independent frontend apps under one home.**

Each team deploys their app to its own GitHub Pages repo (or any host). Launchpad is the front door: a curated directory with links, descriptions, and team groupings. It also serves the marketing and pitch pages, and distributes the `/launch` Claude Code skill for one-command deploys.

**Live:** [https://djohnsonkc.github.io/launchpad/](https://djohnsonkc.github.io/launchpad/)

> For the why-this-exists pitch, see [docs/pitch-tech-leads.md](docs/pitch-tech-leads.md) (engineering) or [docs/pitch-exec.md](docs/pitch-exec.md) (executive).

## Adding an app

Edit `apps.json` and add an entry:

```json
{
  "folder": "team/app-slug",
  "name": "App Display Name",
  "team": "Team Name",
  "creator": "Jane Doe",
  "description": "One-line description.",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "url": "https://where-the-app-lives.example.com/"
}
```

Commit and push — the dashboard updates on the next deploy.

## Commands

```bash
npm install
npm run dev    # build + watch + serve at http://localhost:3000/launchpad/
npm run build  # render all pages to dist/
```

## Deploy (GitHub Pages)

Push to `main` triggers `.github/workflows/deploy.yml`, which builds `dist/` and deploys it automatically. GitHub Pages must be configured to use **GitHub Actions** as the source under repo Settings → Pages.

## Structure

```
src/
  build.ts          # build entry point
  lib/base.ts       # BASE_PATH constant + url() helper
  lib/store.ts      # AppMeta type
  views/
    layout.ts       # shared HTML shell and nav
    dashboard.ts    # home page (app grid/list)
    page.ts         # markdown page renderer
apps.json           # static app catalog
docs/               # pitch and ops docs
.claude/skills/launch/SKILL.md  # /launch deploy skill
```

## The `/launch` skill

Install the Claude Code skill that builds and deploys an app in one command:

```sh
# macOS / Linux / Git Bash
curl -fsSL https://djohnsonkc.github.io/launchpad/skill/install.sh | sh

# Windows PowerShell
irm https://djohnsonkc.github.io/launchpad/skill/install.ps1 | iex
```

Then from any project: `/launch path/to/your-app`

> **Note:** The `/launch` skill's upload endpoint (`POST /api/deploy`) requires a separate API server — a lightweight Node server is planned. Until then, apps are added to `apps.json` manually.
