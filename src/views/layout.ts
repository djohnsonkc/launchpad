export type NavSlug = 'home' | 'tech-leads' | 'exec';

interface LayoutOptions {
  title: string;
  content: string;
  active?: NavSlug;
  /** Extra HTML to inject just before </body> — typically page-specific scripts or dialogs. */
  bodyExtras?: string;
}

// Rocket icon served from public/rocket.svg — used for both the nav badge and favicon.
const ROCKET_ICON_URL = '/rocket.svg';

const NAV_ITEMS: { slug: NavSlug; label: string; href: string }[] = [
  { slug: 'home', label: 'Home', href: '/' },
  { slug: 'tech-leads', label: 'For Tech Leads', href: '/pitch/tech-leads' },
  { slug: 'exec', label: 'For Executives', href: '/pitch/exec' },
];

export function layout({ title, content, active, bodyExtras = '' }: LayoutOptions): string {
  const desktopNavLinks = NAV_ITEMS.map(item => {
    const isActive = active === item.slug;
    const activeClasses = isActive
      ? 'text-[var(--pc-color-primary)] font-medium'
      : 'text-[var(--pc-text-secondary)] hover:text-[var(--pc-font-color)]';
    return `<a href="${item.href}" class="px-3 py-2 text-sm no-underline whitespace-nowrap transition-colors ${activeClasses}">${item.label}</a>`;
  }).join('');

  const mobileNavLinks = NAV_ITEMS.map(item => {
    const isActive = active === item.slug;
    const activeClasses = isActive
      ? 'text-[var(--pc-color-primary)] font-medium bg-[var(--pc-surface-raised)]'
      : 'text-[var(--pc-text-secondary)] hover:bg-[var(--pc-surface-raised)]';
    return `<a href="${item.href}" class="block px-3 py-3 text-sm no-underline rounded-md transition-colors ${activeClasses}">${item.label}</a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="icon" type="image/svg+xml" href="${ROCKET_ICON_URL}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --pc-color-primary: #3b82f6;
      --pc-color-success: #16a34a;
      --pc-color-warning: #d97706;
      --pc-color-danger: #dc2626;
      --pc-color-accent: #8b5cf6;
      --pc-surface-base: #ffffff;
      --pc-surface-raised: #f9fafb;
      --pc-font-color: #111827;
      --pc-font-color-on-surface: #111827;
      --pc-border-color: #e5e7eb;
      --pc-text-muted: #9ca3af;
      --pc-text-secondary: #6b7280;
      --pc-card-bg: var(--pc-surface-base);
      --pc-card-hover: #f9fafb;
    }
    html.dark {
      --pc-color-primary: #5ba3d9;
      --pc-surface-base: #2a2d31;
      --pc-surface-raised: #36393f;
      --pc-font-color: #D1D5DB;
      --pc-font-color-on-surface: #333;
      --pc-border-color: #374151;
      --pc-text-muted: #6b7280;
      --pc-text-secondary: #9ca3af;
      --pc-card-bg: var(--pc-surface-raised);
      --pc-card-hover: rgba(55, 65, 81, 0.5);
    }

    /* Rocket icon: recolor to white in app dark mode.
       brightness(0) flattens all pixels to black; invert(1) flips black to white.
       Single-color SVG, so the result is a clean white silhouette. */
    html.dark .rocket-icon { filter: brightness(0) invert(1); }

    /* Markdown page typography (rendered HTML output from marked) */
    .markdown-content { line-height: 1.65; }
    .markdown-content h1 { font-size: 1.875rem; font-weight: 600; margin: 0 0 1rem; color: var(--pc-font-color); }
    .markdown-content h2 { font-size: 1.375rem; font-weight: 600; margin: 2rem 0 0.75rem; padding-bottom: 0.375rem; border-bottom: 1px solid var(--pc-border-color); color: var(--pc-font-color); }
    .markdown-content h3 { font-size: 1.125rem; font-weight: 600; margin: 1.5rem 0 0.5rem; color: var(--pc-font-color); }
    .markdown-content h4 { font-size: 1rem; font-weight: 600; margin: 1.25rem 0 0.5rem; color: var(--pc-font-color); }
    .markdown-content p { margin: 0 0 1rem; color: var(--pc-font-color); }
    .markdown-content ul, .markdown-content ol { margin: 0 0 1rem; padding-left: 1.5rem; color: var(--pc-font-color); }
    .markdown-content li { margin-bottom: 0.25rem; }
    .markdown-content a { color: var(--pc-color-primary); text-decoration: none; }
    .markdown-content a:hover { text-decoration: underline; }
    .markdown-content code { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; font-size: 0.875em; padding: 0.125rem 0.375rem; border-radius: 4px; background: var(--pc-surface-raised); border: 1px solid var(--pc-border-color); }
    .markdown-content pre { background: var(--pc-surface-raised); border: 1px solid var(--pc-border-color); border-radius: 8px; padding: 1rem; overflow-x: auto; margin: 0 0 1rem; }
    .markdown-content pre code { background: transparent; border: 0; padding: 0; font-size: 0.875rem; }
    .markdown-content blockquote { border-left: 3px solid var(--pc-color-primary); padding: 0.25rem 0 0.25rem 1rem; margin: 0 0 1rem; color: var(--pc-text-secondary); font-style: italic; }
    .markdown-content table { width: 100%; border-collapse: collapse; margin: 0 0 1rem; font-size: 0.9375rem; }
    .markdown-content th, .markdown-content td { border: 1px solid var(--pc-border-color); padding: 0.5rem 0.75rem; text-align: left; }
    .markdown-content th { background: var(--pc-surface-raised); font-weight: 600; }
    .markdown-content hr { border: 0; border-top: 1px solid var(--pc-border-color); margin: 2rem 0; }
    .markdown-content strong { font-weight: 600; }
  </style>
  <script>
    // Apply theme early to prevent flash
    (function() {
      var saved = localStorage.getItem('theme');
      if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      }
    })();
  </script>
  <script src="https://unpkg.com/@tailwindcss/browser@4"></script>
  <style type="text/tailwindcss">
    @theme {
      --font-sans: "Open Sans", ui-sans-serif, system-ui, sans-serif;
      --color-brand-primary: var(--pc-color-primary);
      --color-brand-success: var(--pc-color-success);
      --color-brand-warning: var(--pc-color-warning);
      --color-brand-danger: var(--pc-color-danger);
      --color-brand-accent: var(--pc-color-accent);
      --color-surface-base: var(--pc-surface-base);
      --color-surface-raised: var(--pc-surface-raised);
    }
  </style>
</head>
<body class="bg-surface-base text-[var(--pc-font-color)] font-sans m-0">
  <nav class="bg-surface-base border-b border-[var(--pc-border-color)] sticky top-0 z-10">
    <div class="max-w-4xl mx-auto px-6 py-3">
      <div class="flex items-center justify-between gap-4">
        <a href="/" class="flex items-center gap-2 no-underline text-[var(--pc-font-color)] shrink-0">
          <img src="${ROCKET_ICON_URL}" alt="" class="rocket-icon" width="32" height="32" style="display:block">
          <span class="text-lg font-semibold">Launchpad</span>
        </a>

        <div class="flex items-center gap-1">
          <!-- Desktop nav links (hidden below md) -->
          <div class="hidden md:flex md:items-center md:gap-1">
            ${desktopNavLinks}
          </div>

          <!-- Theme toggle (always visible) -->
          <button onclick="toggleTheme()" title="Toggle light/dark mode"
            class="md:ml-2 bg-transparent border-0 cursor-pointer text-[var(--pc-text-muted)] p-2 rounded-lg hover:bg-[var(--pc-surface-raised)] transition-colors shrink-0">
            <svg id="icon-sun" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hidden"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            <svg id="icon-moon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </button>

          <!-- Mobile hamburger (hidden above md) -->
          <button id="menu-button" onclick="toggleMobileMenu()" type="button" aria-expanded="false" aria-controls="mobile-menu" aria-label="Toggle menu"
            class="md:hidden bg-transparent border-0 cursor-pointer text-[var(--pc-text-muted)] p-2 rounded-lg hover:bg-[var(--pc-surface-raised)] transition-colors shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>
      </div>

      <!-- Mobile menu drawer (collapsed by default, hidden on md+) -->
      <div id="mobile-menu" class="md:hidden hidden mt-3 pt-3 border-t border-[var(--pc-border-color)]">
        <div class="flex flex-col gap-1">
          ${mobileNavLinks}
        </div>
      </div>
    </div>
  </nav>

  ${content}

  <script>
    function applyTheme(dark) {
      document.documentElement.classList.toggle('dark', dark);
      document.getElementById('icon-sun').classList.toggle('hidden', !dark);
      document.getElementById('icon-moon').classList.toggle('hidden', dark);
    }

    function toggleTheme() {
      const dark = !document.documentElement.classList.contains('dark');
      localStorage.setItem('theme', dark ? 'dark' : 'light');
      applyTheme(dark);
    }

    function toggleMobileMenu() {
      const menu = document.getElementById('mobile-menu');
      const button = document.getElementById('menu-button');
      const expanded = button.getAttribute('aria-expanded') === 'true';
      menu.classList.toggle('hidden');
      button.setAttribute('aria-expanded', String(!expanded));
    }

    (function() {
      const saved = localStorage.getItem('theme');
      const prefersDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
      applyTheme(prefersDark);
    })();
  </script>
  ${bodyExtras}
</body>
</html>`;
}
