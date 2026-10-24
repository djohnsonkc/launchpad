# Persistence

How Launchpad keeps deployed apps alive across container restarts, image redeploys, and host events. Add a new dated entry under **Decisions** whenever a persistence-related design choice is made.

## What needs to persist

Two artifacts, shared fate:

| Artifact | Location | What's in it | Approx size |
|---|---|---|---|
| Bundle files | `apps/<folder>/` | Extracted static assets for each deployed app | Hundreds of MB to GBs total |
| Metadata store | `data/apps-meta/<team>/<slug>.json` (one file per app) | Display name, team, creator, description, timestamps, URL | Few KB per file |

If metadata survives but bundles don't, the dashboard lists apps that 404 when clicked. If bundles survive but metadata doesn't, the dashboard goes empty but stale URLs still resolve. Both must share a lifecycle — one volume covering both, or two volumes provisioned together.

## Current state

- The Dockerfile creates both directories at image-build time ([Dockerfile:15](../Dockerfile)) so the paths exist on first boot.
- Both directories are gitignored ([.gitignore](../.gitignore)) — they're runtime state, not source.
- **Volumes are not yet declared in the production compose file.** Today, a container redeploy with a new image tag would lose all deployed apps because the runtime directories are part of the container's writable layer, not a persistent volume.

> **Action required:** declare named volumes for `/app/apps` and `/app/data` in your production compose file (Docker Compose, Swarm, Kubernetes, etc.). See the decision below.

## Failure modes

| Event | With named volumes | Without (current state) |
|---|---|---|
| Container restart (same image) | Survives | Survives |
| **Image redeploy (new tag)** | Survives | **All apps lost** |
| Host reboot | Survives | Depends on volume driver |
| Volume manually deleted | Lost | — |
| Host destroyed / lost | Lost (unless backed up off-host) | Lost |

The image-redeploy row is the main one. That's the routine "Launchpad ships a new version" path, and without volumes it wipes everything every time.

## Decisions

### Decision: Persist via named Docker volumes

- **Date:** 2026-06-04
- **Status:** Accepted, implementation pending (compose change lives in the operator's deployment config)

**Context.** The Dockerfile already separates runtime data into `apps/` and `data/`, but the production compose does not yet mount volumes onto those paths. An image redeploy currently destroys all deployed apps.

**Decision.** Declare two named Docker volumes in the production compose and mount them onto `/app/apps` and `/app/data` respectively. Sketch:

```yaml
services:
  launchpad:
    image: launchpad:${SERVICE_TAG}
    volumes:
      - launchpad_apps:/app/apps
      - launchpad_data:/app/data

volumes:
  launchpad_apps:
  launchpad_data:
```

(Exact form depends on your deployment conventions — driver, naming scheme, NFS/host-bind options.)

**Why named, not anonymous, volumes?** Anonymous volumes get a new identity per container and can be orphaned on redeploy. Named volumes have stable identity across container/image lifecycles — that's the whole point.

**Why two volumes instead of one?** Mainly so the metadata can be backed up cheaply (it's tiny — KB) on a separate cadence from the bulk bundle data (GB). Single volume works too; two is just slightly more flexible.

**Backups.** Named Docker volumes survive container/image churn but not host loss or volume deletion. A periodic tarball of both volumes to off-host storage (object storage, NFS, etc.) is the disaster-recovery layer. Out of scope for this decision; tracked under [Open items](#open-items).

### Decision: Heroku — durable bundle archive on inspiredeffect.com, restored on startup

- **Date:** 2026-10-24
- **Status:** Implemented (Launchpad side + archive API); archive deployment pending

**Context.** On Heroku there are no volumes: the dyno filesystem is wiped on every restart (at least daily) and release, taking `apps/` and `data/` with it. The named-volume decision above doesn't apply there. Serving bundles straight from object storage would mean re-architecting static serving and SPA fallback; MongoDB was considered and rejected (16 MB document limit, small free-tier storage).

**Decision.** Keep local filesystem serving unchanged and treat it as a cache of a durable archive: a single self-contained page, **`launchpad.ashx`** at the inspiredeffect.com root, which stores each zip as-is plus a metadata JSON under the site's `App_Data/launchpad/<team>/<app>.{zip,json}`. One file was chosen over a separate IIS application with its own config because this is a prototype: deploying is copying one file, and rolling back is deleting it. The page compiles on its own, so a bug in it only breaks that URL, and adding or removing it doesn't restart the site.

| Flow | Behavior |
|---|---|
| Deploy | Extract to `data/staging/` (validates the zip) → upload zip + metadata to the archive, confirm sha256 → swap into `apps/<folder>/` → write metadata. Archive failure returns `502`; the previous version stays live. |
| Startup | Bind `PORT` first (Heroku's 60s boot limit), then restore apps missing locally or with a different sha256, 3 at a time, each verified by sha256. Missing apps answer `503 Retry-After` until restore finishes; deploys/deletes are refused meanwhile. One failed app doesn't block the rest. |
| Delete | Archive first, then local. If the archive is unreachable, nothing is removed — so an app can never be resurrected by the next restore. |
| Not configured | `ARCHIVE_URL` / `ARCHIVE_TOKEN` unset → local-only, identical to before. |

**Archive page** (`Authorization: Bearer <token>`, token read from `App_Data/launchpad/token.txt`; only GET/POST because shared IIS hosts often block PUT/DELETE):

| Request | Purpose |
|---|---|
| `GET launchpad.ashx` | JSON array of metadata (`folder, name, team, creator, description, url, createdAt, updatedAt, size, sha256`) |
| `GET launchpad.ashx?folder=team/app` | Download the zip |
| `POST launchpad.ashx?folder=team/app&name=…` | Store a zip (raw body, streamed to disk); metadata in the query string; returns `size` + `sha256` |
| `POST launchpad.ashx?folder=team/app&delete=1` | Delete (`404` if absent) |

**Setup:** see [Runbook: Heroku bundle archive](#runbook-heroku-bundle-archive) below.

**Constraints.** Single dyno only (dynos don't share disk). Startup restore time grows with total bundle size. The archive page inherits ASP.NET's default 4 MB request limit (see [scaling.md](./scaling.md)).

## Runbook: Heroku bundle archive

How to switch on, verify, and roll back the archive described in the decision above. The page lives in the inspiredeffect.com repo as `launchpad.ashx`.

### 1. Install the page on inspiredeffect.com

1. Generate a token:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
2. Upload `launchpad.ashx` to the **site root**, the same way you deploy the rest of the site.
3. Create `App_Data/launchpad/token.txt` on the server containing only the token. `App_Data` is gitignored and never served by IIS, so the token stays private. A git-based deploy won't create this file; add it by hand.

No control-panel step, no config changes, and no site restart: ASP.NET compiles the page on first request, independently of the rest of the site.

### 2. Verify the page

```bash
curl -H "Authorization: Bearer <token>" https://inspiredeffect.com/launchpad.ashx
```

| Response | Meaning |
|---|---|
| `[]` (or a JSON list) | Working |
| `401 {"error":"Invalid token."}` | Token in the request doesn't match `token.txt` |
| `503 {"error":"token.txt not set up."}` | `token.txt` missing or empty |
| `500` on the first upload | The site can't write to `App_Data/launchpad` — grant write permission on `App_Data` in the Winhost control panel |

Then confirm `https://inspiredeffect.com/` and a FoxFilter page still load normally.

### 3. Point Launchpad at it

```bash
heroku config:set ARCHIVE_URL=https://inspiredeffect.com/launchpad.ashx ARCHIVE_TOKEN=<token>
```

Setting config restarts the dyno. Its log should show `Archive: https://inspiredeffect.com/launchpad.ashx` and then `Archive restore finished … 0 restored` (nothing stored yet). Deploy an app, run `heroku restart`, and check the log reports `1 restored` and the app still loads.

### 4. Upload size: the 4 MB limit

The page has no config of its own, so ASP.NET's default request limit of 4 MB applies. A larger deploy fails with `502 … Archive upload failed (HTTP 413): Maximum request length exceeded`, and the previous version stays live.

To raise it, add a `<location>` block for the page to the site's root `Web.Config` (100 MB shown; `maxRequestLength` is in KB, `maxAllowedContentLength` in bytes):

```xml
<location path="launchpad.ashx">
  <system.web>
    <httpRuntime maxRequestLength="102400" executionTimeout="600"/>
  </system.web>
  <system.webServer>
    <security>
      <requestFiltering>
        <requestLimits maxAllowedContentLength="104857600"/>
      </requestFiltering>
    </security>
  </system.webServer>
</location>
```

This touches the main site's `Web.Config`, and saving that file restarts the site once. To avoid editing it, move the page into its own folder (e.g. `/launchpad/launchpad.ashx`, updating `ARCHIVE_URL`) with a small `web.config` there containing the same `system.web` and `system.webServer` sections. Check after deploying that the folder-level setting takes effect on the host, since that hasn't been confirmed on Winhost.

Keep Launchpad's `MAX_UPLOAD_MB` at or below whatever limit you set here.

### 5. Roll back

- **Turn off persistence only:** `heroku config:unset ARCHIVE_URL ARCHIVE_TOKEN`. Launchpad goes back to local-only storage; stored bundles stay in `App_Data/launchpad`.
- **Remove the page entirely:** delete `launchpad.ashx` from the server (and unset the Heroku config first, or every deploy will fail with `502`). Delete `App_Data/launchpad/` too if the stored bundles are no longer wanted.

## Open items

### Off-host backups

Named volumes don't protect against host destruction or accidental volume removal. A weekly (or daily) tarball of `apps/` + `data/` pushed to S3-compatible object storage or NFS would close the gap. Implementation likely a cron job or scheduled GitHub workflow that SSHes onto the host, tars the volumes, and uploads.

**Action item:** decide on a cadence and target. Document the script once written.

### Graduation: object storage for bundles

Docker volumes have a practical ceiling — they're tied to a single host (unless you're on a clustered volume driver), they're awkward to migrate, and total capacity is constrained by the host's disk. The graduation path when any of those becomes a real problem:

- **Bundles → S3-compatible object storage** (AWS S3, MinIO, Cloudflare R2). Uploads stream straight to object storage; Launchpad becomes stateless for bundles. Serving is either a redirect or a streaming proxy.

Triggers worth watching:

- Total `apps/` size approaches host disk capacity
- Multi-host Launchpad deployment becomes desirable (load balancing, HA)
- Off-host durability becomes a compliance requirement

### Graduation: database for metadata

The per-file metadata store (one JSON file per app, atomic rename on write) is good enough for a single-instance, small-dataset, simple-schema world. A database becomes the right call when any of these happen:

- **Multi-instance Launchpad.** The per-file store survives concurrent deploys of *different* apps on a single instance, but not concurrent deploys across multiple Launchpad processes writing to the same shared filesystem. Postgres or SQLite gives real transactions.
- **Audit / history.** Tracking deploy events over time (who, when, what changed) is naturally a row-per-event model, ugly as repeated JSON file rewrites.
- **Search / query.** Filtering apps by team, age, creator, etc. against a directory of JSON files gets slow and clumsy past a few hundred entries (each list call walks the tree).

If a DB is introduced, bundles still belong on filesystem or object storage — big binary blobs do not belong in databases.

### Multi-instance considerations

If we ever scale to >1 Launchpad replica behind a load balancer, the current architecture has two issues:

1. **Concurrent writers across processes.** The per-file store eliminates the read-modify-write race within a single process (different files = different writes), but two processes deploying the same app at once still race on the same file. A real DB with transactions is the proper fix.
2. **Per-host bundle storage** means a request hitting replica B might not find an app that replica A served. Needs shared bundle storage — clustered volume (NFS/GlusterFS) or object storage.

Both are tractable but represent a meaningful re-architecture. Not justified at single-instance scale.
