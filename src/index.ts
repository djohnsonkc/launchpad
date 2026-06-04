import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { deployRouter } from './routes/deploy.js';
import { appsRouter } from './routes/apps.js';
import { renderDashboard } from './views/dashboard.js';
import { getAppList } from './lib/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

app.use(cors());
app.use(express.json());

// ─── API Routes ──────────────────────────────────────────────
app.use('/api', deployRouter);
app.use('/api', appsRouter);

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

// ─── Dashboard ───────────────────────────────────────────────
app.get('/', async (_req, res) => {
  const apps = await getAppList();
  res.type('html').send(renderDashboard(apps));
});

// ─── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Launchpad running at http://localhost:${PORT}`);
  console.log(`Deploy endpoint: POST http://localhost:${PORT}/api/deploy`);
});
