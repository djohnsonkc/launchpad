import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { deployRouter } from './routes/deploy.js';
import { appsRouter } from './routes/apps.js';
import { skillRouter } from './routes/skill.js';
import { renderDashboard } from './views/dashboard.js';
import { renderMarkdownPage } from './views/page.js';
import { getAppList } from './lib/store.js';
import { isArchiveEnabled } from './lib/archive.js';
import { isRestoring, restoreFromArchive } from './lib/restore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

// Behind Heroku's router (or any proxy), honor X-Forwarded-Proto so returned URLs use https.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

// ─── Public static assets (logo, favicon, etc.) ──────────────
app.use(express.static(path.join(ROOT, 'public')));

// ─── API Routes ──────────────────────────────────────────────
app.use('/api', deployRouter);
app.use('/api', appsRouter);

// ─── /launch skill distribution (install page, installers, SKILL.md) ──
app.use(skillRouter);

// ─── Serve app static files ──────────────────────────────────
// Each app lives at /apps/:name/ and is a self-contained SPA
app.use('/apps', express.static(path.join(ROOT, 'apps')));

// SPA fallback for each app (so client-side routing works)
// Handles both /apps/:team/:name and /apps/:name for backwards compatibility
app.use('/apps/:team/:name', (req, res, next) => {
  if (req.method !== 'GET') return next();
  const appDir = path.join(ROOT, 'apps', req.params.team, req.params.name);
  res.sendFile(path.join(appDir, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use('/apps/:name', (req, res, next) => {
  if (req.method !== 'GET') return next();
  const appDir = path.join(ROOT, 'apps', req.params.name);
  res.sendFile(path.join(appDir, 'index.html'), (err) => {
    if (err) next();
  });
});

// While startup restore is running, a missing app is "not yet", not "never".
app.use('/apps', (_req, res, next) => {
  if (!isRestoring()) return next();
  res.set('Retry-After', '15').status(503).type('text').send('Launchpad is restoring apps after a restart. Refresh in a few seconds.');
});

// ─── Dashboard ───────────────────────────────────────────────
app.get('/', async (_req, res) => {
  const apps = await getAppList();
  res.type('html').send(renderDashboard(apps));
});

// ─── Content pages (rendered from markdown) ──────────────────
app.get('/pitch/product', async (_req, res, next) => {
  try {
    const html = await renderMarkdownPage({
      filePath: path.join(ROOT, 'docs', 'pitch-product.md'),
      title: 'Product Teams — Launchpad',
      active: 'product',
    });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

app.get('/pitch/tech-leads', async (_req, res, next) => {
  try {
    const html = await renderMarkdownPage({
      filePath: path.join(ROOT, 'docs', 'pitch-tech-leads.md'),
      title: 'Engineers — Launchpad',
      active: 'tech-leads',
    });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

app.get('/pitch/exec', async (_req, res, next) => {
  try {
    const html = await renderMarkdownPage({
      filePath: path.join(ROOT, 'docs', 'pitch-exec.md'),
      title: 'Executives — Launchpad',
      active: 'exec',
    });
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
});

// ─── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Launchpad running at http://localhost:${PORT}`);
  console.log(`Deploy endpoint: POST http://localhost:${PORT}/api/deploy`);
  console.log(isArchiveEnabled() ? `Archive: ${process.env.ARCHIVE_URL}` : 'Archive: not configured (local storage only)');
  // Restore after binding PORT — Heroku kills dynos that take longer than 60s to bind.
  void restoreFromArchive();
});
