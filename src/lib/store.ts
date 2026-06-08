import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const APPS_META_DIR = path.join(DATA_DIR, 'apps-meta');

export interface AppMeta {
  folder: string;
  name: string;
  team: string;
  creator: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  url: string;
}

async function ensureMetaDir(): Promise<void> {
  await fs.mkdir(APPS_META_DIR, { recursive: true });
}

function metaFilePath(folder: string): string {
  return path.join(APPS_META_DIR, folder + '.json');
}

export async function getAppList(): Promise<AppMeta[]> {
  await ensureMetaDir();

  let entries: string[];
  try {
    entries = (await fs.readdir(APPS_META_DIR, { recursive: true })) as string[];
  } catch {
    return [];
  }

  const results: AppMeta[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const fullPath = path.join(APPS_META_DIR, entry);
    try {
      const raw = await fs.readFile(fullPath, 'utf-8');
      results.push(JSON.parse(raw) as AppMeta);
    } catch (err) {
      // Skip unreadable / mid-write files; surfacing rather than failing the whole list
      console.warn(`Skipping metadata file ${entry}:`, err);
    }
  }
  return results;
}

export async function upsertApp(meta: AppMeta): Promise<void> {
  await ensureMetaDir();
  const target = metaFilePath(meta.folder);
  await fs.mkdir(path.dirname(target), { recursive: true });

  // Atomic write: write to a temp file in the same directory, then rename.
  // rename() is atomic on POSIX and effectively atomic on Windows when the
  // target is on the same volume.
  const tempPath = `${target}.tmp.${crypto.randomBytes(8).toString('hex')}`;
  await fs.writeFile(tempPath, JSON.stringify(meta, null, 2));
  await fs.rename(tempPath, target);
}

export async function deleteApp(folder: string): Promise<boolean> {
  const target = metaFilePath(folder);
  try {
    await fs.unlink(target);
  } catch {
    return false;
  }

  // Best-effort cleanup of empty parent directory (e.g., data/apps-meta/dywayne/)
  try {
    await fs.rmdir(path.dirname(target));
  } catch {
    // Parent isn't empty (other apps in same team) or it's the root meta dir — fine
  }
  return true;
}
