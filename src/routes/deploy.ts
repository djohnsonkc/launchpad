import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import fs from 'fs/promises';
import { upsertApp, deleteApp, getApp, type AppMeta } from '../lib/store.js';
import { requireDeployToken } from '../lib/auth.js';
import {
  APPS_DIR, normalizeFolder, sha256File, extractToStaging, installStaged, discardStaged,
} from '../lib/bundle.js';
import { isArchiveEnabled, uploadBundle, deleteBundle } from '../lib/archive.js';
import { isRestoring } from '../lib/restore.js';

// Default 100 MB: keeps dyno memory/disk safe and fits the archive's request limit.
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '100', 10);
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, cb) => {
      const random = crypto.randomBytes(16).toString('hex');
      cb(null, `launchpad-upload-${random}.zip`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

export const deployRouter = Router();

/** Writes during startup restore could race with it, so ask the client to retry. */
function rejectWhileRestoring(_req: Request, res: Response, next: NextFunction): void {
  if (isRestoring()) {
    res.set('Retry-After', '30').status(503).json({ error: 'Launchpad is restoring apps from the archive. Retry shortly.' });
    return;
  }
  next();
}

/**
 * POST /api/deploy
 *
 * Accepts a multipart form with:
 *   - file: zipped dist/ folder
 *   - folder: kebab-case slug used as URL path (e.g., "menu-analytics")
 *   - name: display name for the app (e.g., "Menu Analytics — Recipe Building")
 *   - team: team display name (e.g., "Food", "UX")
 *   - creator: who deployed it
 *   - description: optional description
 *
 * Extracts the zip into /apps/<folder>/ and returns the app URL. When the
 * archive is configured, the zip is persisted there before the new version
 * goes live; if that fails, the previous version stays untouched.
 */
deployRouter.post('/deploy', requireDeployToken, rejectWhileRestoring, (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ error: `File too large. Maximum size is ${MAX_UPLOAD_MB}MB.` });
        return;
      }
      res.status(400).json({ error: err.message });
      return;
    }
    if (err) {
      next(err);
      return;
    }
    handleDeploy(req, res).catch(next);
  });
});

async function handleDeploy(req: Request, res: Response): Promise<void> {
  const file = req.file;
  const tempPath = file?.path;
  let staged: string | null = null;

  try {
    // Non-multipart requests leave req.body undefined; treat that as "no fields" so it's a 400, not a 500.
    const body = req.body ?? {};
    const folder = normalizeFolder(body.folder);
    const name = String(body.name ?? folder).trim();
    const team = String(body.team ?? '').trim();
    const creator = String(body.creator ?? 'unknown').trim();
    const description = String(body.description ?? '').trim();

    if (!file) {
      res.status(400).json({ error: 'No file uploaded. Send a zipped dist/ folder as "file".' });
      return;
    }

    if (!folder) {
      res.status(400).json({ error: 'Missing "folder" field. Provide a kebab-case slug for the app URL.' });
      return;
    }

    // Extracting to staging first validates the zip without touching the live app.
    try {
      staged = await extractToStaging(tempPath!);
    } catch (err) {
      console.error('Extract error:', err);
      res.status(400).json({ error: 'Could not extract the uploaded file. Is it a valid zip?' });
      return;
    }

    const host = req.get('host') || 'localhost:4000';
    const url = `${req.protocol}://${host}/apps/${folder}/`;
    const now = new Date().toISOString();
    const existing = await getApp(folder);
    const bundleSha256 = await sha256File(tempPath!);

    const meta: AppMeta = {
      folder,
      name,
      team,
      creator,
      description,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      url,
      bundleSha256,
    };

    if (isArchiveEnabled()) {
      try {
        await uploadBundle(tempPath!, meta, bundleSha256);
      } catch (err) {
        console.error('Archive upload error:', err);
        const reason = err instanceof Error ? ` (${err.message})` : '';
        res.status(502).json({ error: `Failed to persist the app to the archive${reason}. The previous version (if any) is still live.` });
        return;
      }
    }

    await installStaged(staged, folder);
    staged = null;
    await upsertApp(meta);

    res.json({
      success: true,
      folder,
      name,
      url,
      message: `App deployed successfully. Share this URL: ${url}`,
    });
  } catch (err) {
    console.error('Deploy error:', err);
    res.status(500).json({ error: 'Failed to deploy app.' });
  } finally {
    if (staged) await discardStaged(staged).catch(() => { /* best effort */ });
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => { /* ignore — already gone */ });
    }
  }
}

/**
 * DELETE /api/deploy/:folder
 *
 * Removes an app and its files. When the archive is configured it is deleted
 * there first, so a failure never leaves an app that would be resurrected on
 * the next restart.
 */
deployRouter.delete('/deploy/:folder', requireDeployToken, rejectWhileRestoring, async (req: Request, res: Response) => {
  try {
    const folder = normalizeFolder(req.params.folder);
    if (!folder) {
      res.status(400).json({ error: 'Invalid folder.' });
      return;
    }

    let archived = false;
    if (isArchiveEnabled()) {
      try {
        archived = await deleteBundle(folder);
      } catch (err) {
        console.error('Archive delete error:', err);
        res.status(502).json({ error: 'Failed to delete the app from the archive. Nothing was removed.' });
        return;
      }
    }

    await fs.rm(path.join(APPS_DIR, folder), { recursive: true, force: true });
    const deleted = await deleteApp(folder);

    if (deleted || archived) {
      res.json({ success: true, message: `App "${folder}" deleted.` });
    } else {
      res.status(404).json({ error: `App "${folder}" not found.` });
    }
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete app.' });
  }
});
