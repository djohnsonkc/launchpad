# Scaling Decisions

Operational limits and the reasoning behind them. Add a new dated entry under **Decisions** whenever a scaling-related design choice is made.

## Current operational limits

| Concern | Limit | Where it's set |
|---|---|---|
| Max upload size | 1 GB | [src/routes/deploy.ts](../src/routes/deploy.ts) — `MAX_UPLOAD_BYTES` |
| Upload memory model | Streamed to disk (`os.tmpdir()`) | [src/routes/deploy.ts](../src/routes/deploy.ts) — multer `diskStorage()` |
| Extraction memory model | Streamed entry-by-entry (constant heap) | [src/routes/deploy.ts](../src/routes/deploy.ts) — `extractZipStreaming` via `unzipper` |
| Oversized upload response | `413 Payload Too Large` with clear message | [src/routes/deploy.ts](../src/routes/deploy.ts) — `LIMIT_FILE_SIZE` handler |
| Concurrent uploads | Unbounded | No app-level cap |
| Persistent storage | Docker volumes for `apps/` and `data/` | [Dockerfile](../Dockerfile), see also [persistence.md](./persistence.md) |

## Decisions

### Decision: 1GB cap with disk-based uploads and streaming extraction

- **Date:** 2026-06-04
- **Status:** Implemented

**Context.** A real-world example bundle (`dashboard-site`) is 306 MB — well over the original 50 MB multer cap. Even raising the cap, `multer.memoryStorage()` buffered the entire upload as a `Buffer` in heap, putting a single deploy at ~20% of Node's default ~1.5 GB heap. Two or three concurrent large deploys risked OOM-killing the container. The previous extraction library (`adm-zip`) also loaded the full zip into memory regardless of how it was passed in.

**Decision.**

1. Switched multer to `diskStorage()` writing to `os.tmpdir()` with random filenames. Upload streams to a temp file on disk; heap stays flat during the upload regardless of file size.
2. Raised `limits.fileSize` to 1 GB. Gives ~3× headroom over the 306 MB example with a clear hard ceiling.
3. Replaced `adm-zip` with [`unzipper`](https://www.npmjs.com/package/unzipper) for streaming extraction. Entries are piped one at a time straight to disk; heap stays at a few MB regardless of zip size. Both upload and extraction now have constant-memory characteristics.
4. Added explicit `MulterError` handling so oversized uploads return `413 Payload Too Large` with a clear message instead of the previous generic 500.
5. Wrap the whole handler in `try/finally` and `fs.unlink` the temp file in `finally` so failed deploys don't leak disk.
6. Added zip-slip protection — entries whose resolved target path escapes the destination directory are rejected before any bytes are written. AdmZip had this built in; we now do it ourselves.
7. **Normalize backslashes to forward slashes** when reading zip entry paths. PowerShell's `Compress-Archive` (used by the proto-share skill among others) writes entry paths with `\` separators, violating the zip spec's MUST-use-forward-slash requirement. Without this normalization, wrapper-folder detection fails on Windows-built zips and on Linux servers the files would extract with literal backslashes in their names. Discovered via smoke test against a `Compress-Archive`-built fixture.

**Why not chunked / resumable uploads?** Implementation complexity (state, retries, partial-cleanup) isn't justified at this scale. A single-shot HTTP POST works fine up to ~1 GB on reasonable links. Revisit if bundles routinely exceed 1 GB or upload reliability becomes an issue.

**Why `unzipper` over `yauzl`?** Both are mature streaming-zip libraries. `unzipper` is promise-friendly and exposes the central directory up front via `unzipper.Open.file(path)`, which makes wrapper-folder detection a single pass over metadata before any extraction work happens. `yauzl` is lower-level (callback-based) and would require more glue for the same outcome.

**Why `os.tmpdir()` and not a project-local `tmp/` folder?** The OS-managed temp directory is restart-safe, requires no extra config, and the file is unlinked the moment the handler returns. A project-local `tmp/` only helps if we need to inspect failed uploads — defer until that need is real.

## Open items

### Reverse proxy limits (not yet investigated)

If Launchpad is fronted by nginx, Traefik, Caddy, or any other reverse proxy in production, the proxy enforces its own body-size and timeout limits independent of multer. Two settings to verify whenever the proxy stack is identified:

- **Body size limit.** nginx defaults to `client_max_body_size 1m` — well under our 1 GB cap. Needs raising to at least `1g`. Traefik defaults to unlimited but Portainer's edge config may not. Caddy defaults to unlimited.
- **Read/write timeouts.** A 1 GB upload from a 10 Mbps office uplink takes ~15 minutes; on 100 Mbps, ~80 seconds. nginx defaults to 60s for proxy reads — will time out mid-upload on slow links. Raise to a generous value (e.g., 30 minutes) on the upload endpoint.

**Action item:** confirm the proxy topology in the Portainer stack and document the exact directives once known.

### Beyond 1 GB

If bundles routinely exceed 1 GB, change the transport rather than raising the cap further:

- **Resumable uploads** (tus.io protocol, S3 multipart). Handles network interruptions and supports clients on flaky links.
- **Out-of-band delivery.** Upload zips to object storage, send Launchpad a reference URL; the server pulls and extracts. Decouples upload reliability from the deploy endpoint.

No work needed today, but the path forward is documented.
