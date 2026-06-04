import { Router } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { upsertApp, deleteApp } from '../lib/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APPS_DIR = path.resolve(__dirname, '../../apps');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

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
deployRouter.post('/deploy', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const folder = (req.body.folder || '').trim().toLowerCase().replace(/[^a-z0-9\/-]/g, '-').replace(/^\/|\/$/g, '');
    const name = (req.body.name || folder).trim();
    const team = (req.body.team || '').trim();
    const creator = (req.body.creator || 'unknown').trim();
    const description = (req.body.description || '').trim();

    if (!file) {
      res.status(400).json({ error: 'No file uploaded. Send a zipped dist/ folder as "file".' });
      return;
    }

    if (!folder) {
      res.status(400).json({ error: 'Missing "folder" field. Provide a kebab-case slug for the app URL.' });
      return;
    }

    // Extract zip to apps directory
    const appDir = path.join(APPS_DIR, folder);
    await fs.rm(appDir, { recursive: true, force: true });
    await fs.mkdir(appDir, { recursive: true });

    const zip = new AdmZip(file.buffer);
    zip.extractAllTo(appDir, true);

    // If the zip contained a single top-level folder (e.g., "dist/"), flatten it
    const entries = await fs.readdir(appDir);
    if (entries.length === 1) {
      const subDir = path.join(appDir, entries[0]);
      const stat = await fs.stat(subDir);
      if (stat.isDirectory()) {
        const subEntries = await fs.readdir(subDir);
        for (const entry of subEntries) {
          await fs.rename(path.join(subDir, entry), path.join(appDir, entry));
        }
        await fs.rmdir(subDir);
      }
    }

    // Build the app URL
    const host = req.get('host') || 'localhost:4000';
    const protocol = req.protocol;
    const url = `${protocol}://${host}/apps/${folder}/`;

    // Save metadata
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
  }
});

/**
 * DELETE /api/deploy/:folder
 *
 * Removes an app and its files.
 */
deployRouter.delete('/deploy/:folder', async (req, res) => {
  try {
    const folder = req.params.folder;
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
