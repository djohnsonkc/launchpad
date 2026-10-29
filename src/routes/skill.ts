import { Router, type Request } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { layout } from '../views/layout.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_PATH = path.resolve(__dirname, '../../.claude/skills/launch/SKILL.md');
// The default server URL written in SKILL.md; replaced with the serving host's
// origin so an installed skill always deploys to the Launchpad it came from.
const DEFAULT_SERVER_URL = 'https://launchpad.inspiredeffect.com';

export const skillRouter = Router();

function origin(req: Request): string {
  return `${req.protocol}://${req.get('host')}`;
}

async function skillMarkdown(req: Request): Promise<string> {
  const md = await fs.readFile(SKILL_PATH, 'utf-8');
  return md.split(DEFAULT_SERVER_URL).join(origin(req));
}

/** GET /skill — install instructions for people deploying apps. */
skillRouter.get('/skill', (req, res) => {
  const o = origin(req);
  const code = (cmd: string) =>
    `<pre class="rounded-lg border p-4 overflow-x-auto text-sm" style="border-color:var(--pc-border-color);background:var(--pc-surface-raised)"><code>${cmd}</code></pre>`;
  const content = `
  <main class="max-w-3xl mx-auto px-6 py-10">
    <h1 class="text-3xl font-bold tracking-tight text-[var(--pc-heading-color)] mb-3">Get the /launch skill</h1>
    <p class="text-[var(--pc-text-secondary)] leading-relaxed mb-8">The <strong>/launch</strong> skill lets Claude Code build your app, package it, and deploy it to this Launchpad in one step, then hands you a shareable link. Install it once; it works from any project.</p>

    <h2 class="text-lg font-semibold text-[var(--pc-font-color)] mb-2">1. Install</h2>
    <p class="text-sm text-[var(--pc-text-secondary)] mb-2">macOS, Linux, or Git Bash:</p>
    ${code(`curl -fsSL ${o}/skill/install.sh | sh`)}
    <p class="text-sm text-[var(--pc-text-secondary)] mt-4 mb-2">Windows PowerShell:</p>
    ${code(`irm ${o}/skill/install.ps1 | iex`)}
    <p class="text-sm text-[var(--pc-text-secondary)] mt-3 mb-8">This saves one file, <code>~/.claude/skills/launch/SKILL.md</code>. Run it again any time to update. Prefer to look first? <a href="/skill/SKILL.md" class="text-[var(--pc-color-primary)] no-underline hover:underline">View the skill</a>.</p>

    <h2 class="text-lg font-semibold text-[var(--pc-font-color)] mb-2">2. Deploy</h2>
    <p class="text-sm text-[var(--pc-text-secondary)] mb-2">Restart Claude Code, then from any folder:</p>
    ${code('/launch path/to/your-app')}
    <p class="text-sm text-[var(--pc-text-secondary)] mt-3 mb-8">It detects Vite, Create React App, and Angular, asks for a name and team, confirms before uploading, and remembers your answers for next time. Run it again to update the same link.</p>

    <h2 class="text-lg font-semibold text-[var(--pc-font-color)] mb-2">Deploy token</h2>
    <p class="text-sm text-[var(--pc-text-secondary)] leading-relaxed">If this Launchpad requires a deploy token, the skill will ask for it the first time and can save it to <code>~/.launchpad/token</code>. Ask whoever runs Launchpad for the token.</p>
  </main>`;
  res.type('html').send(layout({ title: 'Get the /launch skill — Launchpad', content }));
});

/** GET /skill/SKILL.md — the /launch skill, pointed at this server. */
skillRouter.get('/skill/SKILL.md', async (req, res, next) => {
  try {
    res.type('text/markdown').send(await skillMarkdown(req));
  } catch (err) {
    next(err);
  }
});

/** GET /skill/install.sh — macOS / Linux / Git Bash: curl -fsSL <origin>/skill/install.sh | sh */
skillRouter.get('/skill/install.sh', (req, res) => {
  res.type('text/x-shellscript').send(`#!/bin/sh
# Installs the Launchpad /launch skill for Claude Code into ~/.claude/skills/launch/.
set -e
dir="$HOME/.claude/skills/launch"
mkdir -p "$dir"
curl -fsSL "${origin(req)}/skill/SKILL.md" -o "$dir/SKILL.md"
echo "Installed the /launch skill to $dir/SKILL.md"
echo "Restart Claude Code, then run: /launch <path-to-your-app>"
`);
});

/** GET /skill/install.ps1 — Windows PowerShell: irm <origin>/skill/install.ps1 | iex */
skillRouter.get('/skill/install.ps1', (req, res) => {
  res.type('text/plain').send(`# Installs the Launchpad /launch skill for Claude Code into ~/.claude/skills/launch/.
$ErrorActionPreference = 'Stop'
$dir = Join-Path $HOME '.claude\\skills\\launch'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Invoke-WebRequest -UseBasicParsing -Uri '${origin(req)}/skill/SKILL.md' -OutFile (Join-Path $dir 'SKILL.md')
Write-Host "Installed the /launch skill to $dir\\SKILL.md"
Write-Host 'Restart Claude Code, then run: /launch <path-to-your-app>'
`);
});
