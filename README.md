# Launchpad

Lightweight deployment server that hosts net-new React apps at unique URLs. Designed for Rosnet teams building apps with the [rosnet-ui](https://rosnetui.rosnetdev.com) library — ship a working app to stakeholders without standing up infrastructure, CI/CD pipelines, or Kubernetes manifests for every new experiment.

Launchpad is intentionally simple: build your React app locally, zip the `dist/` folder, POST it, and Launchpad serves it at a shareable URL.

## How it works

1. A developer builds a React app locally (e.g., a Vite app using the rosnet-ui component library)
2. They zip the `dist/` (or equivalent build output) folder
3. They POST the zip to `/api/deploy` with metadata (team, name, description, creator)
4. Launchpad extracts the bundle and returns a shareable URL (e.g., `https://launchpad.rosnetdev.com/apps/<team>/<app-name>`)
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

**Metadata store** — `data/apps.json` maintains a registry of all deployed apps. Each entry tracks the app's display name, owning team, creator, description, deploy timestamps, and the URL path used to serve it. When an app is deployed via `POST /api/deploy`, the server performs an upsert — inserting a new record or updating the existing one if the same folder slug already exists. This ensures redeployments cleanly overwrite previous versions without leaving orphaned entries.

```json
[
  {
    "folder": "ux/scheduling",
    "name": "Scheduling Workflow v2",
    "team": "UX",
    "creator": "Dywayne Johnson",
    "description": "Progressive scheduling flow for managers",
    "createdAt": "2026-06-04T14:13:07.319Z",
    "updatedAt": "2026-06-04T14:13:07.319Z",
    "url": "/apps/ux/scheduling/"
  }
]
```

**Static file store** — `apps/` contains the actual app builds, organized by team and app name (e.g., `apps/ux/scheduling/`). When a zip is uploaded, the server extracts it into the appropriate directory, automatically flattening single-folder archives (e.g., if the zip contains a `dist/` wrapper, the contents are promoted to the top level). Express serves these as static files with SPA fallback routing, so client-side navigation works out of the box.

Both directories are mounted as Docker volumes in production, ensuring app data persists across container restarts and redeployments.
