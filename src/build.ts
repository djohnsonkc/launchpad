import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderDashboard } from './views/dashboard.js';
import { renderMarkdownPage } from './views/page.js';
import { layout, type NavSlug } from './views/layout.js';
import { url } from './lib/base.js';
import type { AppMeta } from './lib/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SKILL_ORIGIN = process.env.SKILL_ORIGIN ?? 'https://djohnsonkc.github.io/launchpad';

async function write(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

function renderSkillPage(): string {
  const o = SKILL_ORIGIN;
  const code = (cmd: string) =>
    `<pre class="rounded-lg border p-4 overflow-x-auto text-sm" style="border-color:var(--pc-border-color);background:var(--pc-surface-raised)"><code>${cmd}</code></pre>`;
  const content = `
  <main class="max-w-3xl mx-auto px-6 py-10">
    <h1 class="text-3xl font-bold tracking-tight text-[var(--pc-heading-color)] mb-3">Get the /launch skill</h1>
    <p class="text-[var(--pc-text-secondary)] leading-relaxed mb-8">The <strong>/launch</strong> skill lets Claude Code build your app, package it, and deploy it to Launchpad in one step, then hands you a shareable link. Install it once; it works from any project.</p>

    <h2 class="text-lg font-semibold text-[var(--pc-font-color)] mb-2">1. Install</h2>
    <p class="text-sm text-[var(--pc-text-secondary)] mb-2">macOS, Linux, or Git Bash:</p>
    ${code(`curl -fsSL ${o}/skill/install.sh | sh`)}
    <p class="text-sm text-[var(--pc-text-secondary)] mt-4 mb-2">Windows PowerShell:</p>
    ${code(`irm ${o}/skill/install.ps1 | iex`)}
    <p class="text-sm text-[var(--pc-text-secondary)] mt-3 mb-8">This saves one file, <code>~/.claude/skills/launch/SKILL.md</code>. Run it again any time to update. Prefer to look first? <a href="${url('/skill/SKILL.md')}" class="text-[var(--pc-color-primary)] no-underline hover:underline">View the skill</a>.</p>

    <h2 class="text-lg font-semibold text-[var(--pc-font-color)] mb-2">2. Deploy</h2>
    <p class="text-sm text-[var(--pc-text-secondary)] mb-2">Restart Claude Code, then from any folder:</p>
    ${code('/launch path/to/your-app')}
    <p class="text-sm text-[var(--pc-text-secondary)] mt-3 mb-8">It detects Vite, Create React App, and Angular, asks for a name and team, confirms before uploading, and remembers your answers for next time. Run it again to update the same link.</p>

    <h2 class="text-lg font-semibold text-[var(--pc-font-color)] mb-2">Deploy token</h2>
    <p class="text-sm text-[var(--pc-text-secondary)] leading-relaxed">If this Launchpad requires a deploy token, the skill will ask for it the first time and can save it to <code>~/.launchpad/token</code>. Ask whoever runs Launchpad for the token.</p>
  </main>`;
  return layout({ title: 'Get the /launch skill — Launchpad', content });
}

async function main(): Promise<void> {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });

  try {
    await copyDir(path.join(ROOT, 'public'), DIST);
  } catch {
    // public/ not present — skip
  }

  const apps: AppMeta[] = JSON.parse(
    await fs.readFile(path.join(ROOT, 'apps.json'), 'utf-8')
  );

  await write(path.join(DIST, 'index.html'), renderDashboard(apps));

  const pitchPages: Array<{ slug: string; file: string; title: string; active: NavSlug }> = [
    { slug: 'product',    file: 'pitch-product.md',    title: 'Product Teams — Launchpad', active: 'product' },
    { slug: 'tech-leads', file: 'pitch-tech-leads.md', title: 'Engineers — Launchpad',      active: 'tech-leads' },
    { slug: 'exec',       file: 'pitch-exec.md',       title: 'Executives — Launchpad',     active: 'exec' },
  ];

  for (const { slug, file, title, active } of pitchPages) {
    const html = await renderMarkdownPage({
      filePath: path.join(ROOT, 'docs', file),
      title,
      active,
    });
    await write(path.join(DIST, 'pitch', slug, 'index.html'), html);
  }

  await write(path.join(DIST, 'skill', 'index.html'), renderSkillPage());

  const skillMd = await fs.readFile(
    path.join(ROOT, '.claude', 'skills', 'launch', 'SKILL.md'),
    'utf-8'
  );
  await write(path.join(DIST, 'skill', 'SKILL.md'), skillMd);

  await write(path.join(DIST, 'skill', 'install.sh'), `#!/bin/sh
set -e
dir="$HOME/.claude/skills/launch"
mkdir -p "$dir"
curl -fsSL "${SKILL_ORIGIN}/skill/SKILL.md" -o "$dir/SKILL.md"
echo "Installed the /launch skill to $dir/SKILL.md"
echo "Restart Claude Code, then run: /launch <path-to-your-app>"
`);

  await write(path.join(DIST, 'skill', 'install.ps1'), `# Installs the Launchpad /launch skill for Claude Code into ~/.claude/skills/launch/.
$ErrorActionPreference = 'Stop'
$dir = Join-Path $HOME '.claude\\\\skills\\\\launch'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Invoke-WebRequest -UseBasicParsing -Uri '${SKILL_ORIGIN}/skill/SKILL.md' -OutFile (Join-Path $dir 'SKILL.md')
Write-Host "Installed the /launch skill to $dir\\\\SKILL.md"
Write-Host 'Restart Claude Code, then run: /launch <path-to-your-app>'
`);

  console.log(`Built ${apps.length} app${apps.length === 1 ? '' : 's'} → ${DIST}`);
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
