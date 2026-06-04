import { Router } from 'express';
import { getAppList } from '../lib/store.js';

export const appsRouter = Router();

/**
 * GET /api/apps
 *
 * Returns a JSON list of all deployed apps with metadata.
 */
appsRouter.get('/apps', async (_req, res) => {
  const apps = await getAppList();
  res.json(apps);
});
