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
