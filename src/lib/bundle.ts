import unzipper from 'unzipper';
import path from 'path';
import crypto from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import fs from 'fs/promises';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const APPS_DIR = path.resolve(__dirname, '../../apps');
// Lives under data/ (not apps/) so half-extracted bundles are never web-served.
const STAGING_DIR = path.resolve(__dirname, '../../data/staging');

/** Restricts a folder slug to [a-z0-9-] segments so it can never escape APPS_DIR. */
export function normalizeFolder(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\/-]/g, '-')
    .split('/')
    .filter(Boolean)
    .join('/');
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  await pipeline(createReadStream(filePath), hash);
  return hash.digest('hex');
}

/**
 * Extracts a zip into a fresh staging directory and returns its path.
 * Nothing under apps/ is touched, so a corrupt zip never takes down the live app.
 */
export async function extractToStaging(zipPath: string): Promise<string> {
  await fs.mkdir(STAGING_DIR, { recursive: true });
  const stagingDir = await fs.mkdtemp(path.join(STAGING_DIR, 'bundle-'));
  try {
    await extractZipStreaming(zipPath, stagingDir);
    return stagingDir;
  } catch (err) {
    await fs.rm(stagingDir, { recursive: true, force: true });
    throw err;
  }
}

/** Swaps a staged bundle into apps/<folder>/, replacing any previous version. */
export async function installStaged(stagingDir: string, folder: string): Promise<void> {
  const appDir = path.join(APPS_DIR, folder);
  await fs.rm(appDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(appDir), { recursive: true });
  await fs.rename(stagingDir, appDir);
}

export async function discardStaged(stagingDir: string): Promise<void> {
  await fs.rm(stagingDir, { recursive: true, force: true });
}

export async function appDirExists(folder: string): Promise<boolean> {
  try {
    return (await fs.stat(path.join(APPS_DIR, folder))).isDirectory();
  } catch {
    return false;
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
