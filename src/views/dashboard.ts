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
    ? `<div class="rounded-lg border-2 border-dashed px-6 py-12 text-center" style="border-color:var(--pc-border-color);background:var(--pc-card-bg);color:var(--pc-text-muted)">
        <p class="text-sm max-w-prose mx-auto leading-relaxed">No apps deployed yet. Build your app, zip the build output folder, and POST it to <code class="px-1.5 py-0.5 rounded text-sm" style="background:var(--pc-surface-raised)">/api/deploy</code> &mdash; see the <a href="/pitch/tech-leads" class="text-[var(--pc-color-primary)] no-underline hover:underline font-medium">For Tech Leads</a> page for deploy mechanics and APIs.</p>
      </div>`
    : '';

  const content = `
  <main class="max-w-4xl mx-auto px-6 py-8">
    <section class="mb-8">
      <h1 class="text-2xl font-semibold text-[var(--pc-font-color)] mb-2">Deployed Apps</h1>
      <p class="text-sm text-[var(--pc-text-secondary)] leading-relaxed max-w-3xl">
        A shell-architecture alternative for hosting independent apps under one host — no <strong><em>shared runtime</em></strong>, no <strong><em>injection</em></strong>, no <strong><em>iframes</em></strong>. Each app below is a self-contained bundle served at its own URL under <code class="px-1 py-0.5 rounded text-sm" style="background:var(--pc-surface-raised);border:1px solid var(--pc-border-color);font-size:0.85em">/apps/&lt;team&gt;/&lt;slug&gt;/</code>, grouped here by owning team. See the pitch pages for <a href="/pitch/tech-leads" class="text-[var(--pc-color-primary)] no-underline hover:underline font-medium">tech leads</a> (which also covers deploy mechanics and APIs) and <a href="/pitch/exec" class="text-[var(--pc-color-primary)] no-underline hover:underline font-medium">executives</a>.
      </p>
    </section>

    <div class="flex items-center justify-between mb-6">
      <h2 class="text-base font-semibold text-[var(--pc-text-secondary)] uppercase tracking-wider">${apps.length} app${apps.length === 1 ? '' : 's'}</h2>
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
      const res = await fetch('/api/deploy/' + encodeURIComponent(pendingDeleteFolder), { method: 'DELETE' });
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
