import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { ReadableStream as WebReadableStream } from 'stream/web';
import type { AppMeta } from './store.js';

/**
 * Client for the durable bundle archive: a single launchpad.ashx page on
 * inspiredeffect.com (see docs/persistence.md). ARCHIVE_URL is the page's full
 * URL; everything is selected by query string.
 *
 * Optional: when ARCHIVE_URL / ARCHIVE_TOKEN are unset, every caller skips the
 * archive and Launchpad behaves exactly as it does with local storage only.
 */

export interface ArchivedApp extends Omit<AppMeta, 'bundleSha256'> {
  size: number;
  sha256: string;
}

const LIST_TIMEOUT_MS = 30_000;
const TRANSFER_TIMEOUT_MS = 10 * 60_000;

function config(): { url: string; token: string } | null {
  const url = process.env.ARCHIVE_URL;
  const token = process.env.ARCHIVE_TOKEN;
  return url && token ? { url, token } : null;
}

export function isArchiveEnabled(): boolean {
  return config() !== null;
}

async function request(params: Record<string, string>, init: RequestInit & { timeoutMs: number }): Promise<Response> {
  const cfg = config();
  if (!cfg) throw new Error('Archive is not configured.');
  const { timeoutMs, ...rest } = init;
  const url = new URL(cfg.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url, {
    ...rest,
    headers: { ...rest.headers, Authorization: `Bearer ${cfg.token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res;
}

async function failure(res: Response, action: string): Promise<Error> {
  let detail = '';
  try {
    detail = ((await res.json()) as { error?: string }).error ?? '';
  } catch { /* non-JSON body (e.g. an IIS error page) */ }
  return new Error(`Archive ${action} failed (HTTP ${res.status})${detail ? `: ${detail}` : ''}`);
}

export async function listArchivedApps(): Promise<ArchivedApp[]> {
  const res = await request({}, { method: 'GET', timeoutMs: LIST_TIMEOUT_MS });
  if (!res.ok) throw await failure(res, 'list');
  return (await res.json()) as ArchivedApp[];
}

/** Uploads a bundle; resolves only once the archive has confirmed the same sha256. */
export async function uploadBundle(zipPath: string, meta: AppMeta, sha256: string): Promise<void> {
  const params = {
    folder: meta.folder,
    name: meta.name,
    team: meta.team,
    creator: meta.creator,
    description: meta.description,
    url: meta.url,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
  // Uploads are capped (MAX_UPLOAD_MB), so buffering keeps the request simple:
  // a fixed Content-Length is the most compatible option for IIS.
  const body = await fs.readFile(zipPath);
  const res = await request(params, {
    method: 'POST',
    headers: { 'Content-Type': 'application/zip' },
    body,
    timeoutMs: TRANSFER_TIMEOUT_MS,
  });
  if (!res.ok) throw await failure(res, 'upload');
  const stored = (await res.json()) as { sha256?: string };
  if (stored.sha256 !== sha256) {
    throw new Error(`Archive upload checksum mismatch (expected ${sha256}, got ${stored.sha256}).`);
  }
}

export async function downloadBundle(folder: string, destPath: string): Promise<void> {
  const res = await request({ folder }, {
    method: 'GET',
    timeoutMs: TRANSFER_TIMEOUT_MS,
  });
  if (!res.ok || !res.body) throw await failure(res, 'download');
  await pipeline(Readable.fromWeb(res.body as WebReadableStream), createWriteStream(destPath));
}

/** Deletes a bundle. Returns false if the archive didn't have it. */
export async function deleteBundle(folder: string): Promise<boolean> {
  const res = await request({ folder, delete: '1' }, {
    method: 'POST',
    timeoutMs: LIST_TIMEOUT_MS,
  });
  if (res.status === 404) return false;
  if (!res.ok) throw await failure(res, 'delete');
  return true;
}
