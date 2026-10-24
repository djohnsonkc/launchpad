import type { AppMeta } from '../lib/store.js';
import { layout } from './layout.js';

export function renderDashboard(apps: AppMeta[]): string {
  const sorted = apps
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  // Group apps by team
  const grouped = new Map<string, AppMeta[]>();
  for (const p of sorted) {
    const team = p.team || 'Other';
    if (!grouped.has(team)) grouped.set(team, []);
    grouped.get(team)!.push(p);
  }

  const teamSections = Array.from(grouped.entries())
    .map(([team, items]) => `
      <div class="mb-8">
        <div class="flex items-center gap-3 mb-4 border-b border-[var(--pc-border-color)] pb-2">
          <h2 class="text-base font-semibold text-[var(--pc-font-color)]">${team}</h2>
          <span class="text-sm text-[var(--pc-text-muted)]">(${items.length})</span>
        </div>

        <!-- Grid view -->
        <div class="view-grid hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          ${items.map(p => `
            <a href="/apps/${p.folder}/" class="rounded-lg border border-[var(--pc-border-color)] shadow-sm hover:shadow-md transition-all flex flex-col no-underline text-inherit cursor-pointer" style="background:var(--pc-card-bg)" onmouseenter="this.style.background='var(--pc-card-hover)'" onmouseleave="this.style.background='var(--pc-card-bg)'">
              <div class="p-5 flex-1">
                <div class="flex items-start justify-between mb-2">
                  <h3 class="text-base font-semibold text-[var(--pc-font-color)] leading-snug flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pc-text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>${p.name}</h3>
                  <button onclick="event.preventDefault(); event.stopPropagation(); deleteApp('${p.folder}')" title="Delete app"
                    class="bg-transparent border-0 cursor-pointer text-[var(--pc-text-muted)] p-1 rounded inline-flex items-center justify-center hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 ml-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <p class="text-sm text-[var(--pc-text-secondary)] leading-relaxed mb-3">${p.description || 'No description provided.'}</p>
                <span class="text-sm font-medium text-[var(--pc-color-primary)]">Open App &rarr;</span>
              </div>
              <div class="border-t border-[var(--pc-border-color)] px-5 py-3 flex items-center gap-3 text-xs text-[var(--pc-text-muted)]">
                <span>${p.creator}</span>
                <span>&middot;</span>
                <span>${new Date(p.updatedAt).toLocaleDateString()}</span>
              </div>
            </a>
          `).join('')}
        </div>

        <!-- List view -->
        <div class="view-list">
          <div class="rounded-lg border border-[var(--pc-border-color)] overflow-hidden" style="background:var(--pc-card-bg)">
            ${items.map((p, i) => `
              <a href="/apps/${p.folder}/" class="flex items-start gap-4 px-5 py-3 ${i > 0 ? 'border-t border-[var(--pc-border-color)]' : ''} transition-colors no-underline text-inherit cursor-pointer" onmouseenter="this.style.background='var(--pc-card-hover)'" onmouseleave="this.style.background='transparent'">
                <div class="flex-1 min-w-0">
                  <span class="text-base font-semibold text-[var(--pc-color-primary)] flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pc-text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>${p.name}</span>
                  <p class="text-sm text-[var(--pc-text-secondary)] truncate mt-0.5">${p.description || 'No description provided.'}</p>
                  <div class="flex items-center gap-3 text-xs text-[var(--pc-text-muted)] mt-1.5">
                    <span>${p.creator}</span>
                    <span>&middot;</span>
                    <span>${new Date(p.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <button onclick="event.preventDefault(); event.stopPropagation(); deleteApp('${p.folder}')" title="Delete app"
                  class="bg-transparent border-0 cursor-pointer text-[var(--pc-text-muted)] p-1 rounded inline-flex items-center justify-center hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 mt-1">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </a>
            `).join('')}
          </div>
        </div>
      </div>
    `)
    .join('');

  const emptyState = apps.length === 0
    ? `<div class="rounded-xl border-2 border-dashed px-6 py-10 text-center" style="border-color:var(--pc-border-color);background:var(--pc-card-bg)">
        <div class="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style="background:var(--pc-surface-raised);color:var(--pc-text-secondary)">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
        </div>
        <p class="text-base font-semibold text-[var(--pc-font-color)] mb-2">No apps deployed yet.</p>
        <p class="text-sm max-w-md mx-auto leading-relaxed text-[var(--pc-text-secondary)]">Build your app, zip the build output folder, and POST to <span class="text-[var(--pc-color-primary)]">/api/deploy</span> &mdash; see the <a href="/pitch/tech-leads" class="text-[var(--pc-color-primary)] no-underline hover:underline">For Tech Leads</a> page for deploy mechanics and APIs.</p>
      </div>`
    : '';

  const content = `
  <div class="relative overflow-hidden" style="background:linear-gradient(180deg, color-mix(in srgb, var(--pc-color-primary) 7%, var(--pc-surface-base)) 0%, var(--pc-surface-base) 70%)">
    <svg aria-hidden="true" class="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1600 700" preserveAspectRatio="none" style="color:var(--pc-color-primary);-webkit-mask-image:linear-gradient(180deg,#000 55%,transparent);mask-image:linear-gradient(180deg,#000 55%,transparent)">
      <path d="M0 110 C 280 150, 450 420, 560 700 L 0 700 Z" fill="currentColor" opacity="0.06"/>
      <path d="M0 250 C 190 290, 320 480, 380 700 L 0 700 Z" fill="currentColor" opacity="0.08"/>
      <path d="M1600 30 C 1370 110, 1250 380, 1190 700 L 1600 700 Z" fill="currentColor" opacity="0.06"/>
      <path d="M1600 210 C 1450 270, 1370 470, 1340 700 L 1600 700 Z" fill="currentColor" opacity="0.08"/>
    </svg>

    <section class="relative max-w-3xl mx-auto px-6 pt-16 pb-12 text-center">
      <p class="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-[var(--pc-color-primary)] mb-5">
        Build freely. Deploy independently.
      </p>
      <h1 class="text-4xl md:text-6xl font-bold tracking-tight leading-[1.08] text-[var(--pc-heading-color)] mb-6">
        One home. Any app.<br>
        <span class="text-[var(--pc-color-primary)]">Deploy instantly.</span>
      </h1>
      <p class="text-base md:text-lg leading-relaxed text-[var(--pc-text-secondary)] max-w-[620px] mx-auto mb-8">
        From rapid prototypes to production-ready frontend applications, Launchpad gives product and engineering teams one place to deploy, explore, and share their work. Use any frontend framework, deploy independently, and share authentication and platform services, all from a single, cost-efficient host.
      </p>
      <div class="flex flex-wrap justify-center gap-4 mb-5">
        <a href="#apps" class="inline-flex items-center gap-2 px-8 py-3 rounded-lg text-sm font-semibold no-underline text-white shadow-sm transition-opacity hover:opacity-90" style="background:var(--pc-color-primary-strong)">
          Explore Apps
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </a>
        <a href="/pitch/product" class="inline-flex items-center px-8 py-3 rounded-lg text-sm font-semibold no-underline border transition-colors hover:bg-[var(--pc-card-hover)]" style="border-color:var(--pc-font-color);color:var(--pc-font-color);background:var(--pc-surface-base)">How It Works</a>
      </div>
      <p class="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-sm text-[var(--pc-text-secondary)]">
        <span>Framework-agnostic</span><span aria-hidden="true" class="text-[var(--pc-text-muted)]">&middot;</span>
        <span>Independent deployments</span><span aria-hidden="true" class="text-[var(--pc-text-muted)]">&middot;</span>
        <span>Shared authentication</span>
      </p>
    </section>

    <section class="relative max-w-6xl mx-auto px-6 pb-10">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div class="rounded-xl border p-5 flex items-start gap-4 shadow-sm" style="border-color:var(--pc-border-color);background:var(--pc-card-bg)">
          <div class="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center" style="background:color-mix(in srgb, var(--pc-color-primary) 14%, transparent);color:var(--pc-color-primary)">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
          </div>
          <div>
            <h3 class="text-base font-semibold text-[var(--pc-font-color)] mb-1">Prototype at speed</h3>
            <p class="text-sm leading-relaxed text-[var(--pc-text-secondary)]">Zip your build and get a shareable URL in minutes. No pipeline required.</p>
          </div>
        </div>

        <div class="rounded-xl border p-5 flex items-start gap-4 shadow-sm" style="border-color:var(--pc-border-color);background:var(--pc-card-bg)">
          <div class="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center" style="background:color-mix(in srgb, var(--pc-color-accent) 14%, transparent);color:var(--pc-color-accent)">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          </div>
          <div>
            <h3 class="text-base font-semibold text-[var(--pc-font-color)] mb-1">Any stack. Any app.</h3>
            <p class="text-sm leading-relaxed text-[var(--pc-text-secondary)]">React, Vue, Angular, or plain HTML. If it builds to static files, it runs here.</p>
          </div>
        </div>

        <div class="rounded-xl border p-5 flex items-start gap-4 shadow-sm" style="border-color:var(--pc-border-color);background:var(--pc-card-bg)">
          <div class="w-14 h-14 rounded-xl shrink-0 flex items-center justify-center" style="background:color-mix(in srgb, var(--pc-color-success) 14%, transparent);color:var(--pc-color-success)">
            <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <div>
            <h3 class="text-base font-semibold text-[var(--pc-font-color)] mb-1">Independent but connected</h3>
            <p class="text-sm leading-relaxed text-[var(--pc-text-secondary)]">Each app ships on its own schedule, with shared authentication and platform services.</p>
          </div>
        </div>
      </div>
    </section>
  </div>

  <main class="max-w-6xl mx-auto px-6 pb-12">
    <div class="border-t border-[var(--pc-border-color)] mb-8"></div>

    <div id="apps" class="flex items-center justify-between mb-6 scroll-mt-6">
      <h2 class="text-base font-semibold text-[var(--pc-text-secondary)] uppercase tracking-wider">Deployed Apps (${apps.length})</h2>
      <div class="flex items-center gap-1">
        <button onclick="setView('grid')" id="btn-grid" title="Grid view"
          class="bg-transparent border-0 cursor-pointer p-2 rounded-lg transition-colors text-[var(--pc-text-muted)]">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
        </button>
        <button onclick="setView('list')" id="btn-list" title="List view"
          class="bg-transparent border-0 cursor-pointer p-2 rounded-lg transition-colors text-[var(--pc-color-primary)]">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </button>
      </div>
    </div>

    ${teamSections}
    ${emptyState}
  </main>`;

  const bodyExtras = `
  <dialog id="delete-dialog" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);margin:0;" class="rounded-lg border border-[var(--pc-border-color)] shadow-xl p-0 bg-[var(--pc-surface-raised)] text-[var(--pc-font-color)] max-w-sm w-full backdrop:bg-black/40">
    <form method="dialog">
      <div class="p-6">
        <h3 class="text-base font-semibold mb-2">Delete App</h3>
        <p class="text-sm" style="color:var(--pc-text-secondary)">Are you sure you want to delete <strong id="delete-name"></strong>? This cannot be undone.</p>
      </div>
      <div class="flex justify-end gap-3 px-6 py-4" style="border-top:1px solid var(--pc-border-color)">
        <button type="submit" class="px-4 py-2 text-sm font-medium rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" style="border:1px solid var(--pc-border-color);background:transparent;color:var(--pc-font-color)">Cancel</button>
        <button type="button" id="delete-confirm" class="px-4 py-2 text-sm font-medium rounded-lg border-0 bg-red-600 text-white cursor-pointer hover:bg-red-700 transition-colors">Delete</button>
      </div>
    </form>
  </dialog>

  <script>
    function setView(mode) {
      const isGrid = mode === 'grid';
      document.querySelectorAll('.view-grid').forEach(el => el.classList.toggle('hidden', !isGrid));
      document.querySelectorAll('.view-list').forEach(el => el.classList.toggle('hidden', isGrid));
      document.getElementById('btn-grid').style.color = isGrid ? 'var(--pc-color-primary)' : 'var(--pc-text-muted)';
      document.getElementById('btn-list').style.color = isGrid ? 'var(--pc-text-muted)' : 'var(--pc-color-primary)';
      localStorage.setItem('viewMode', mode);
    }

    (function() {
      const saved = localStorage.getItem('viewMode');
      if (saved === 'grid') setView('grid');
    })();

    let pendingDeleteFolder = null;

    function deleteApp(folder) {
      pendingDeleteFolder = folder;
      document.getElementById('delete-name').textContent = folder;
      document.getElementById('delete-dialog').showModal();
    }

    document.getElementById('delete-confirm').addEventListener('click', async () => {
      if (!pendingDeleteFolder) return;
      const url = '/api/deploy/' + encodeURIComponent(pendingDeleteFolder);
      const send = (token) => fetch(url, { method: 'DELETE', headers: token ? { Authorization: 'Bearer ' + token } : {} });
      let res = await send(sessionStorage.getItem('deployToken'));
      // Server has DEPLOY_TOKEN set — ask once per browser session.
      if (res.status === 401) {
        const token = prompt('Deploy token required to delete apps:');
        if (token) {
          res = await send(token);
          if (res.ok) sessionStorage.setItem('deployToken', token);
        }
      }
      document.getElementById('delete-dialog').close();
      pendingDeleteFolder = null;
      if (res.ok) location.reload();
      else alert('Failed to delete: ' + (await res.json()).error);
    });

    document.getElementById('delete-dialog').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        e.target.close();
        pendingDeleteFolder = null;
      }
    });
  </script>`;

  return layout({ title: 'Launchpad', content, active: 'home', bodyExtras });
}
