import os from 'os';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';
import { listArchivedApps, downloadBundle, isArchiveEnabled, type ArchivedApp } from './archive.js';
import { appDirExists, extractToStaging, installStaged, normalizeFolder, sha256File } from './bundle.js';
import { getApp, upsertApp } from './store.js';

const CONCURRENCY = 3;

let restoring = false;

/** True while startup restore is running — used to answer 503 instead of 404. */
export function isRestoring(): boolean {
  return restoring;
}

/**
 * Rebuilds apps/ and data/apps-meta/ from the archive. Runs after the server is
 * listening (Heroku kills dynos that don't bind PORT within 60s), so requests
 * for not-yet-restored apps get a 503 until this finishes.
 *
 * Apps already present locally with a matching checksum are skipped. Apps that
 * exist locally but not in the archive are left alone. One failed app never
 * blocks the others.
 */
export async function restoreFromArchive(): Promise<void> {
  if (!isArchiveEnabled()) return;
  restoring = true;
  const started = Date.now();
  try {
    const archived = await listArchivedApps();
    const queue = [...archived];
    let restored = 0, skipped = 0, failed = 0;

    const worker = async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        try {
          if (await restoreOne(item)) restored++;
          else skipped++;
        } catch (err) {
          failed++;
          console.error(`Restore failed for "${item.folder}":`, err);
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`Archive restore finished in ${secs}s: ${restored} restored, ${skipped} up to date, ${failed} failed.`);
  } catch (err) {
    console.error('Archive restore aborted:', err);
  } finally {
    restoring = false;
  }
}

async function restoreOne(item: ArchivedApp): Promise<boolean> {
  const folder = normalizeFolder(item.folder);
  if (!folder || folder !== item.folder) {
    throw new Error(`Archive returned an invalid folder: ${JSON.stringify(item.folder)}`);
  }

  const local = await getApp(folder);
  if (local?.bundleSha256 === item.sha256 && await appDirExists(folder)) return false;

  const tempZip = path.join(os.tmpdir(), `launchpad-restore-${crypto.randomBytes(8).toString('hex')}.zip`);
  try {
    await downloadBundle(folder, tempZip);
    const sha = await sha256File(tempZip);
    if (sha !== item.sha256) throw new Error(`Checksum mismatch (expected ${item.sha256}, got ${sha}).`);

    const staged = await extractToStaging(tempZip);
    await installStaged(staged, folder);
    await upsertApp({
      folder,
      name: item.name,
      team: item.team,
      creator: item.creator,
      description: item.description,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      url: item.url,
      bundleSha256: item.sha256,
    });
    return true;
  } finally {
    await fs.unlink(tempZip).catch(() => { /* ignore — already gone */ });
  }
}
