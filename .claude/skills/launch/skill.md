---
name: launch
description: Builds a local app and deploys it to Launchpad, returning a shareable URL. Detects Vite, CRA, and Angular automatically; prompts for build details otherwise. Use when someone says "launch my app", "deploy to launchpad", or invokes /launch.
---

# Launch — Deploy an App to Launchpad

You are helping a teammate deploy their app to Launchpad. The end goal: build their app locally, zip the build output, POST it to Launchpad's `/api/deploy`, and report the shareable URL.

This skill operates on **any** app — it does not assume a specific repo layout. The path to the user's app is supplied by them.

## Configuration

- **Launchpad server URL** — default `https://launchpad.rosnetdev.com`, overridden by the `LAUNCHPAD_SERVER_URL` environment variable if set. Resolve this once at the start and reuse it.

## Workflow

### Step 1: Resolve the app path

If the user invoked `/launch <path>`, use that path. Otherwise, ask:

> What's the path to the app you want to deploy?

Resolve the path to an absolute path. Verify it exists and contains a `package.json` (or, in manual mode, at least something that looks like a buildable project). If it doesn't, say so and stop.

### Step 2: Check for a cached `.launchpad.json`

Look for `<appPath>/.launchpad.json`. If it exists, parse it. It will look like:

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

If found, **skip to Step 6** (confirm details). The cached config is the source of truth for repeat deploys.

If not found, continue to Step 3 to detect framework and gather metadata.

### Step 3: Detect framework

Read `<appPath>/package.json`. Inspect dependencies and devDependencies, and check for config files.

| If you see... | Set framework | Default `buildCommand` | Default `buildDir` |
|---|---|---|---|
| `vite` in deps OR a `vite.config.{ts,js,mjs}` file exists | `vite` | `npm run build` | `dist` |
| `react-scripts` in deps | `cra` | `npm run build` | `build` |
| `@angular/cli` in deps | `angular` | `npm run build` | `dist/<project>` (read from `angular.json`) |
| `next` in deps | **not supported** — see below | — | — |
| None of the above | `manual` | (prompt) | (prompt) |

**Next.js is not supported** for static deployment. If detected, stop and tell the user:

> Launchpad hosts pre-built static bundles. Next.js apps with server components, ISR, or API routes need a runtime — they can't be served as static files. If your Next app is configured for static export (`output: 'export'`), you can use `/launch` with manual mode and point at the `out/` directory.

Ask the user if they want to proceed in manual mode pointed at the static export output. If yes, set `framework = 'manual'` and continue. Otherwise stop.

If `manual` mode, prompt the user for both `buildCommand` and `buildDir`. Defaults to suggest: `npm run build` and `dist`.

### Step 4: Gather metadata

Prompt the user for the following. Pre-populate defaults where you can.

- **Team** — short kebab-case slug (e.g., `ux`, `food`, `labor`, `pc`, `platform`). No default.
- **Folder slug** — the URL slug under the team (e.g., `scheduling`). Default: kebab-cased name of the app directory.
- **Display name** — human-readable (e.g., "Scheduling Workflow v2"). Default: from `package.json`'s `name` field, title-cased.
- **Description** — one-line description. Default: from `package.json`'s `description` field if present.

The full **folder** sent to the API will be `<team>/<folder-slug>`. Confirm this with the user.

**Creator** — derive from `git config user.name` run inside the app directory. If it returns nothing, fall back to the user's system username or prompt.

### Step 5: Confirm details

Show a summary and let the user adjust before proceeding:

```
Ready to deploy to Launchpad:

  Path:         /home/dj/projects/scheduling
  Framework:    vite
  Build:        npm run build  →  dist/
  Team:         ux
  Folder:       ux/scheduling
  Name:         Scheduling Workflow
  Description:  Progressive scheduling flow for managers
  Creator:      Dywayne Johnson
  Deploy URL:   https://launchpad.rosnetdev.com/apps/ux/scheduling/

Say "yes" to build and deploy, or tell me what you'd like to change.
```

Wait for explicit confirmation. If the user asks to change any value, update and re-show until they confirm.

### Step 6: Framework-specific guard rail — base path check

This step prevents the single most common Launchpad deploy footgun. **Skip this step in manual mode.**

The deploy slug is `/apps/<folder>/` (with leading and trailing slash). Asset URLs baked into the build must match this prefix.

**Vite:**

Read `<appPath>/vite.config.ts` (or `.js` / `.mjs`). Find the `base` field inside `defineConfig({...})`. Check whether it equals `/apps/<folder>/`.

If `base` is missing or mismatched, tell the user:

> Your Vite `base` is currently `'<current>'`. For deploys to `/apps/<folder>/` it needs to be `'/apps/<folder>/'`. Update vite.config.ts? **[Y/n]**

If they say yes, edit the file to set `base: '/apps/<folder>/'`. If they say no, warn that assets will likely 404 and ask if they want to continue anyway.

**CRA (Create React App):**

Check `<appPath>/package.json` for a `homepage` field. It should equal `/apps/<folder>` (no trailing slash, per CRA convention). Offer to update if mismatched.

**Angular:**

Pre-flight is harder because the `--base-href` is a build-time flag, not a file. Note this in the build command — Angular's effective command should be:

```
npm run build -- --base-href /apps/<folder>/
```

Adjust `buildCommand` accordingly before running it.

**Manual:**

Skip the check. Just remind the user:

> Heads up: your build output needs to reference assets at the `/apps/<folder>/` prefix. If asset URLs are baked in as absolute (e.g., `/assets/foo.js`), they'll 404 once deployed.

### Step 7: Run the build

Execute the build command from the app directory:

```bash
cd <appPath> && <buildCommand>
```

Show the build output to the user. If it fails, stop and report the error. Don't try to fix it automatically.

After a successful build, verify `<appPath>/<buildDir>/index.html` exists. If it doesn't, the build produced unexpected output — stop and report.

### Step 8: Zip the build output

Use PowerShell `Compress-Archive` on Windows (matches the proto-share precedent and is known to work with Launchpad's extractor). The output zip goes in the OS temp directory so it doesn't pollute the user's repo.

```bash
TMP_ZIP="$(mktemp -t launchpad-deploy-XXXXXX).zip" && \
  powershell -Command "Compress-Archive -Path '<appPath>/<buildDir>/*' -DestinationPath '$TMP_ZIP' -Force"
```

(On non-Windows systems, use `zip -r "$TMP_ZIP" .` from inside the build directory instead.)

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

- **Sanitize Unicode in `name` and `description`.** Replace em dashes (`—`), curly quotes (`'`, `'`, `"`, `"`), and other non-ASCII characters with ASCII equivalents (`-`, `'`, `"`) before passing to `curl`. Git Bash on Windows corrupts non-ASCII characters in `-F` arguments.
- **Parse the JSON response.** On success, it contains `{ success: true, folder, name, url, message }`. On failure, it returns a non-2xx with `{ error }`.
- **If you get a `413 Payload Too Large`**, the bundle is over Launchpad's 1 GB cap. Tell the user and stop. See [docs/scaling.md](../../docs/scaling.md) for context.

### Step 10: Write `.launchpad.json`

If `.launchpad.json` did not exist at the start of the run (i.e., this was a fresh deploy), write it now so future deploys skip the prompts:

```json
{
  "team": "<team>",
  "name": "<display-name>",
  "folder": "<team>/<folder-slug>",
  "description": "<description>",
  "buildDir": "<buildDir>",
  "buildCommand": "<buildCommand>",
  "framework": "<framework>"
}
```

Pretty-print with 2-space indentation. Write to `<appPath>/.launchpad.json`.

Mention to the user that you wrote this file and they can commit it (for shared team setup) or add it to `.gitignore` (personal preference).

### Step 11: Report the URL

Present the deploy URL clearly:

```
Your app is live!

[Open: <display-name>](<url>)

It's also listed on the Launchpad dashboard:
<LAUNCHPAD_SERVER_URL>

To redeploy later, run /relaunch from the app directory once that skill ships,
or run /launch <appPath> again — your .launchpad.json will be reused.
```

### Step 12: Clean up

Remove the temp zip:

```bash
rm -f "$TMP_ZIP"
```

## Important rules

- **Never modify the user's source code** except for the opt-in base-path fix in Step 6, and writing `.launchpad.json` in Step 10. Both are confirmed by the user.
- **Always confirm** the deploy details (Step 5) before building or uploading.
- **Always show the deploy URL** after a successful upload.
- **If the upload fails** with a network error, suggest checking `LAUNCHPAD_SERVER_URL` and that Launchpad is reachable. Do not retry automatically.
- **If the build fails**, surface the build tool's output and stop. Let the user fix it before retrying.
- **Do not invoke this skill recursively.** If the user wants to deploy a different app, start a fresh `/launch`.

## Example usage

```
User: /launch ~/projects/scheduling

Claude: Detected framework: vite (vite.config.ts found, vite in deps)
        Default build: npm run build → dist/

        What team owns this app? (e.g., ux, food, labor, pc)

User: ux

Claude: Defaults to use:
          Folder slug: scheduling
          Display name: Scheduling Workflow
          Description: Progressive scheduling flow for managers
          Creator: Dywayne Johnson  (from git config)

        Ready to deploy to Launchpad:

          Path:         /home/dj/projects/scheduling
          Framework:    vite
          Build:        npm run build  →  dist/
          Team:         ux
          Folder:       ux/scheduling
          Name:         Scheduling Workflow
          Description:  Progressive scheduling flow for managers
          Creator:      Dywayne Johnson
          Deploy URL:   https://launchpad.rosnetdev.com/apps/ux/scheduling/

        Say "yes" to build and deploy, or tell me what you'd like to change.

User: yes

Claude: Checking vite.config.ts... base is '/', needs to be '/apps/ux/scheduling/'.
        Update vite.config.ts? [Y/n]

User: y

Claude: Updated vite.config.ts.
        Building... ✓ (8.2s)
        Zipping dist/... ✓
        Uploading to Launchpad... ✓
        Wrote .launchpad.json (commit this to share with teammates, or .gitignore it).

        Your app is live!
        Open: https://launchpad.rosnetdev.com/apps/ux/scheduling/
```
