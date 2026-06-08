---
name: launch
description: Builds a local app and deploys it to Launchpad, returning a shareable URL. Detects Vite, CRA, and Angular automatically; prompts for build details otherwise. Use when someone says "launch my app", "deploy to launchpad", or invokes /launch.
---

# Launch — Deploy an App to Launchpad

You are helping a teammate deploy their app to Launchpad. The end goal: build their app locally, zip the build output, POST it to Launchpad's `/api/deploy`, and report the shareable URL.

This skill operates on **any** app — it does not assume a specific repo layout. The path to the user's app is supplied by them.

## Read-only contract (critical)

**This skill must never write anything inside the target app's repository.** That includes:

- Source files (`vite.config.*`, `package.json`, `index.html`, etc. — never edited)
- Config files belonging to other tools (`.gitignore`, etc.)
- Staging directories (`.launchpad-build/`, `dist-deploy/`, etc.)
- Cache files (the `.launchpad.json` cache lives in the user's home dir — see Step 2)

The only files the skill ever writes are:

1. A **temp zip** in `os.tmpdir()`, deleted in the cleanup step.
2. The **`~/.launchpad/apps.json`** cache in the user's home directory.

Running the framework's normal build (which writes to `dist/`, `build/`, etc.) is fine — that's the framework's behavior, not the skill's, and those dirs are typically gitignored by the user already. The skill just *reads* the build output.

## Configuration

- **Launchpad server URL** — default `https://launchpad.example.com`, overridden by the `LAUNCHPAD_SERVER_URL` environment variable if set. Resolve this once at the start and reuse it.
- **Cache file location** — `~/.launchpad/apps.json`. Single JSON object keyed by absolute app path. Create the `~/.launchpad/` directory if it doesn't exist.

## Workflow

### Step 1: Resolve the app path

If the user invoked `/launch <path>`, use that path. Otherwise, ask:

> What's the path to the app you want to deploy?

Resolve the path to an **absolute path**. Verify it exists. If it doesn't, say so and stop.

### Step 2: Check the cache

Read `~/.launchpad/apps.json` (create the file with `{}` if missing). Look up the entry keyed by the absolute app path resolved in Step 1.

Cache entry shape:

```json
{
  "/absolute/path/to/app": {
    "team": "marketing",
    "name": "Q3 Launch Landing",
    "folder": "marketing/landing-page",
    "description": "Promotional landing page for the Q3 product launch",
    "framework": "vite",
    "buildCommand": "npm run build",
    "buildDir": "dist",
    "includePatterns": null
  }
}
```

For `framework: "manual"`, `includePatterns` is populated instead of `buildCommand`/`buildDir`.

If a cache entry exists, **skip to Step 5** (confirm details using the cached values). The cache is the source of truth for repeat deploys.

If no entry exists, continue to Step 3.

### Step 3: Detect framework

Read `<appPath>/package.json` if it exists. Inspect dependencies and devDependencies, and check for config files.

| If you see... | Set framework | Default `buildCommand` | Default `buildDir` |
|---|---|---|---|
| `vite` in deps OR a `vite.config.{ts,js,mjs}` file exists | `vite` | `npm run build` | `dist` |
| `react-scripts` in deps | `cra` | `npm run build` | `build` |
| `@angular/cli` in deps | `angular` | `npm run build` | `dist/<project>` (read from `angular.json`) |
| `next` in deps | **not supported** — see below | — | — |
| None of the above, OR no `package.json` | `manual` | (n/a) | (n/a) |

**Next.js is not supported** for static deployment. If detected, stop and tell the user:

> Launchpad hosts pre-built static bundles. Next.js apps with server components, ISR, or API routes need a runtime — they can't be served as static files. If your Next app is configured for static export (`output: 'export'`), you can use `/launch` in manual mode pointing at the `out/` directory.

Ask if they want to proceed in manual mode. If yes, set `framework = 'manual'`. Otherwise stop.

**For manual mode** (no recognized framework, or a static site like a hand-written HTML page), prompt:

> What should be included in the deploy? Either:
>   - A single directory relative to the app root (e.g., `public`, `dist`), or
>   - A space-separated list of file globs (e.g., `index.html manifest.json *.svg *.png`)

Parse the response:
- If the input is a single token that exists as a directory in the app, store as `buildDir = <dir>` and leave `includePatterns = null`.
- Otherwise, split by whitespace and store as `includePatterns = ["...", "...", ...]`. Set `buildDir = null`.

### Step 4: Gather metadata

Prompt the user for the following. Pre-populate defaults where you can.

- **Team** — short kebab-case slug (e.g., `marketing`, `growth`, `platform`, `engineering`). No default.
- **Folder slug** — the URL slug under the team (e.g., `landing-page`). Default: kebab-cased name of the app directory.
- **Display name** — human-readable (e.g., "Q3 Launch Landing"). Default: from `package.json`'s `name` field (title-cased) if present, else the directory name.
- **Description** — one-line description. Default: from `package.json`'s `description` field if present.

The full **folder** sent to the API will be `<team>/<folder-slug>`.

**Creator** — derive from `git config user.name` run inside the app directory. If it returns nothing, fall back to the user's system username or prompt.

### Step 5: Confirm details

Show a summary and let the user adjust before proceeding:

```
Ready to deploy to Launchpad:

  Path:         /home/jane/projects/landing-page
  Framework:    vite
  Build:        npm run build  →  dist/
  Team:         marketing
  Folder:       marketing/landing-page
  Name:         Q3 Launch Landing
  Description:  Promotional landing page for the Q3 product launch
  Creator:      Jane Doe
  Deploy URL:   https://launchpad.example.com/apps/marketing/landing-page/

Say "yes" to build and deploy, or tell me what you'd like to change.
```

For manual mode, replace `Build:` with `Include:` and show the patterns or directory.

Wait for explicit confirmation. If the user asks to change any value, update and re-show until they confirm.

### Step 6: Resolve base-path strategy (no source edits)

Asset URLs baked into the build must match the deploy slug `/apps/<folder>/`. The skill handles this **at build time via CLI flag / env var**, not by editing the user's config files.

**Vite:**

Override the base path on the build CLI. The effective build command becomes:

```
npx vite build --base=/apps/<folder>/
```

Use this regardless of what `vite.config.*` says — the CLI flag wins. Set `effectiveBuildCommand` accordingly for Step 7.

**CRA (Create React App):**

Use the `PUBLIC_URL` environment variable, which CRA respects without source changes:

```
PUBLIC_URL=/apps/<folder> npm run build
```

(No trailing slash, per CRA convention.)

**Angular:**

Append the `--base-href` flag:

```
npm run build -- --base-href=/apps/<folder>/
```

**Manual mode:**

There's no CLI override for hand-written HTML. Scan the input files for likely problem patterns — root-absolute asset references in HTML/JSON/CSS:

```
href="/<file>" | src="/<file>" | content="/<file>" | url(/<file>) | "src": "/<file>"
```

If you find any, warn the user:

> Your source uses root-absolute asset paths (e.g., `/favicon.svg`). When deployed at `/apps/<folder>/`, these will 404. To fix, change them to relative paths (e.g., `favicon.svg`) **in your own source** — this skill does not edit your files. Continue anyway? [y/N]

If they say no, stop. If they say yes, continue and accept the 404s.

### Step 7: Run the build

**Skip this step in manual mode** (no build to run; the source files themselves are the bundle).

For Vite / CRA / Angular, execute the **effective build command** from Step 6:

```bash
cd <appPath> && <effectiveBuildCommand>
```

Show the build output to the user. If it fails, stop and report the error. Don't try to fix it automatically.

After a successful build, verify `<appPath>/<buildDir>/index.html` exists. If it doesn't, the build produced unexpected output — stop and report.

### Step 8: Build the deploy zip

The zip is created in `os.tmpdir()` — **never inside the target repo**. Compose the source-path list based on framework:

**Vite / CRA / Angular** — zip the build output directory:

```bash
TMP_ZIP="$(mktemp -t launchpad-deploy-XXXXXX).zip"
powershell -Command "Compress-Archive -Path '<appPath>/<buildDir>/*' -DestinationPath '$TMP_ZIP' -Force"
```

**Manual mode with `buildDir`** — zip the contents of that directory:

```bash
powershell -Command "Compress-Archive -Path '<appPath>/<buildDir>/*' -DestinationPath '$TMP_ZIP' -Force"
```

**Manual mode with `includePatterns`** — pass each pattern explicitly to `Compress-Archive`. PowerShell expands globs:

```bash
powershell -Command "Compress-Archive -Path '<appPath>/<pattern1>','<appPath>/<pattern2>',... -DestinationPath '$TMP_ZIP' -Force"
```

(On non-Windows systems, equivalent: `cd <appPath> && zip -r "$TMP_ZIP" <patterns or buildDir contents>`.)

### Step 9: Upload to Launchpad

POST the zip to the deploy endpoint:

```bash
curl -X POST <LAUNCHPAD_SERVER_URL>/api/deploy \
  -F "file=@$TMP_ZIP" \
  -F "folder=<team>/<folder-slug>" \
  -F "name=<display-name>" \
  -F "team=<team>" \
  -F "creator=<creator>" \
  -F "description=<description>"
```

Important notes:

- **Sanitize Unicode in `name` and `description`.** Replace em dashes (`—`), curly quotes, and other non-ASCII characters with ASCII equivalents before passing to `curl`. Git Bash on Windows corrupts non-ASCII characters in `-F` arguments.
- **Parse the JSON response.** On success, it contains `{ success: true, folder, name, url, message }`. On failure, it returns a non-2xx with `{ error }`.
- **If you get `413 Payload Too Large`**, the bundle is over Launchpad's 1 GB cap. Tell the user and stop. See [docs/scaling.md](../../docs/scaling.md).

### Step 10: Update the cache

Write or update the entry in `~/.launchpad/apps.json` keyed by absolute app path. Include the framework, the build command and dir (or include patterns), and the deploy metadata:

```json
{
  "/absolute/path/to/app": {
    "team": "<team>",
    "name": "<display-name>",
    "folder": "<team>/<folder-slug>",
    "description": "<description>",
    "framework": "<framework>",
    "buildCommand": "<buildCommand or null>",
    "buildDir": "<buildDir or null>",
    "includePatterns": ["...", "..."] or null
  }
}
```

If the file doesn't exist, create it with the single entry. If it exists, merge the new entry in (preserving other apps' entries). Pretty-print with 2-space indentation.

**Do not write any file inside the target app's repo.**

### Step 11: Report the URL

Present the deploy URL clearly:

```
Your app is live!

[Open: <display-name>](<url>)

It's also listed on the Launchpad dashboard:
<LAUNCHPAD_SERVER_URL>

To redeploy later, run /launch <appPath> again — your cached config will be reused
and you'll skip straight to the build step.
```

### Step 12: Clean up

Remove the temp zip:

```bash
rm -f "$TMP_ZIP"
```

## Important rules

- **Never write anything inside the target repo.** Source files, config files, staging dirs, cache files — all are off-limits. This is a hard invariant.
- **Use CLI flags / env vars to fix the base path at build time**, never edit `vite.config.*`, `package.json`'s `homepage`, or Angular config.
- **For static sites with hardcoded root-absolute paths**, warn the user but do not edit their source. They must fix it themselves.
- **Always confirm** the deploy details (Step 5) before building or uploading.
- **Always show the deploy URL** after a successful upload.
- **If the upload fails** with a network error, suggest checking `LAUNCHPAD_SERVER_URL` and that Launchpad is reachable. Do not retry automatically.
- **If the build fails**, surface the build tool's output and stop. Let the user fix it before retrying.
- **Do not invoke this skill recursively.** If the user wants to deploy a different app, start a fresh `/launch`.

## Example usage

```
User: /launch ~/projects/landing-page

Claude: Detected framework: vite (vite.config.ts found, vite in deps)

        What team owns this app? (e.g., marketing, growth, platform)

User: marketing

Claude: Defaults to use:
          Folder slug: landing-page
          Display name: Q3 Launch Landing
          Description: Promotional landing page for the Q3 product launch
          Creator: Jane Doe  (from git config)

        Ready to deploy to Launchpad:

          Path:         /home/jane/projects/landing-page
          Framework:    vite
          Build:        npx vite build --base=/apps/marketing/landing-page/  →  dist/
          Team:         marketing
          Folder:       marketing/landing-page
          Name:         Q3 Launch Landing
          Description:  Promotional landing page for the Q3 product launch
          Creator:      Jane Doe
          Deploy URL:   https://launchpad.example.com/apps/marketing/landing-page/

        Note: --base flag overrides vite.config.ts at build time; your config file is not modified.

        Say "yes" to build and deploy, or tell me what you'd like to change.

User: yes

Claude: Building... ✓ (8.2s)
        Zipping dist/... ✓
        Uploading to Launchpad... ✓
        Cached config to ~/.launchpad/apps.json.

        Your app is live!
        Open: https://launchpad.example.com/apps/marketing/landing-page/
```
