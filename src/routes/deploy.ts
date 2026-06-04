import { Router, type Request, type Response, type NextFunction } from 'express';
import multer from 'multer';
import unzipper from 'unzipper';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';
import { upsertApp, deleteApp } from '../lib/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPS_DIR = path.resolve(__dirname, '../../apps');

const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024; // 1 GB

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
 * Extracts the zip into /apps/<folder>/ and returns the app URL.
 */
deployRouter.post('/deploy', (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        const gb = MAX_UPLOAD_BYTES / 1024 / 1024 / 1024;
        res.status(413).json({ error: `File too large. Maximum size is ${gb}GB.` });
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

  try {
    const folder = String(req.body.folder ?? '').trim().toLowerCase().replace(/[^a-z0-9\/-]/g, '-').replace(/^\/|\/$/g, '');
    const name = String(req.body.name ?? folder).trim();
    const team = String(req.body.team ?? '').trim();
    const creator = String(req.body.creator ?? 'unknown').trim();
    const description = String(req.body.description ?? '').trim();

    if (!file) {
      res.status(400).json({ error: 'No file uploaded. Send a zipped dist/ folder as "file".' });
      return;
    }

    if (!folder) {
      res.status(400).json({ error: 'Missing "folder" field. Provide a kebab-case slug for the app URL.' });
      return;
    }

    const appDir = path.join(APPS_DIR, folder);
    await fs.rm(appDir, { recursive: true, force: true });
    await fs.mkdir(appDir, { recursive: true });

    await extractZipStreaming(tempPath!, appDir);

    const host = req.get('host') || 'localhost:4000';
    const protocol = req.protocol;
    const url = `${protocol}://${host}/apps/${folder}/`;

    await upsertApp({
      folder,
      name,
      team,
      creator,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      url,
    });

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
    if (tempPath) {
      await fs.unlink(tempPath).catch(() => { /* ignore — already gone */ });
    }
  }
}

/**
 * Stream-extracts a zip file into destDir. Memory usage stays flat regardless of
 * archive size — entries are piped one at a time straight to disk.
 *
 * Also handles two concerns the AdmZip version didn't:
 *   - **Wrapper-folder flatten** detected up front from the central directory
 *     (rather than after-the-fact via fs.rename), so we never write the wrapper
 *     to disk in the first place.
 *   - **Zip-slip protection** — entries whose resolved target escapes destDir
 *     are rejected before any bytes get written.
 */
async function extractZipStreaming(zipPath: string, destDir: string): Promise<void> {
  const directory = await unzipper.Open.file(zipPath);

  // PowerShell's Compress-Archive (commonly used by Windows deploy clients)
  // writes entry paths with backslash separators, violating the zip spec.
  // Normalize once up front so the rest of the logic — wrapper detection,
  // path.join, zip-slip checks — works correctly on both Linux and Windows.
  const normalized = directory.files.map(entry => ({
    entry,
    path: entry.path.replace(/\\/g, '/'),
  }));

  // Detect wrapper folder: all entries share a single top-level segment AND
  // no entry is a file at the root level.
  const topLevelSegments = new Set<string>();
  let hasRootFiles = false;
  for (const { entry, path: p } of normalized) {
    const segments = p.split('/').filter(Boolean);
    if (segments.length === 0) continue;
    const isDir = entry.type === 'Directory' || p.endsWith('/');
    if (segments.length === 1 && !isDir) hasRootFiles = true;
    topLevelSegments.add(segments[0]);
  }

  const stripPrefix = (!hasRootFiles && topLevelSegments.size === 1)
    ? Array.from(topLevelSegments)[0] + '/'
    : '';

  const resolvedDest = path.resolve(destDir);

  for (const { entry, path: p } of normalized) {
    let relativePath = p;
    if (stripPrefix) {
      if (!relativePath.startsWith(stripPrefix)) continue;
      relativePath = relativePath.slice(stripPrefix.length);
    }
    if (!relativePath) continue; // skip the wrapper directory entry itself

    const targetPath = path.join(destDir, relativePath);
    const resolved = path.resolve(targetPath);

    // Zip-slip protection: target must stay within destDir
    if (resolved !== resolvedDest && !resolved.startsWith(resolvedDest + path.sep)) {
      throw new Error(`Zip entry escapes destination: ${entry.path}`);
    }

    const isDir = entry.type === 'Directory' || p.endsWith('/');
    if (isDir) {
      await fs.mkdir(targetPath, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await pipeline(entry.stream(), createWriteStream(targetPath));
    }
  }
}

/**
 * DELETE /api/deploy/:folder
 *
 * Removes an app and its files.
 */
deployRouter.delete('/deploy/:folder', async (req: Request, res: Response) => {
  try {
    const folder = String(req.params.folder);
    const appDir = path.join(APPS_DIR, folder);

    await fs.rm(appDir, { recursive: true, force: true });

    const deleted = await deleteApp(folder);

    if (deleted) {
      res.json({ success: true, message: `App "${folder}" deleted.` });
    } else {
      res.status(404).json({ error: `App "${folder}" not found.` });
    }
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete app.' });
  }
});
