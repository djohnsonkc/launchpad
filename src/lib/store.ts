import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const APPS_FILE = path.join(DATA_DIR, 'apps.json');

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

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function getAppList(): Promise<AppMeta[]> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(APPS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function upsertApp(meta: AppMeta): Promise<void> {
  const list = await getAppList();
  const idx = list.findIndex(p => p.folder === meta.folder);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...meta, updatedAt: new Date().toISOString() };
  } else {
    list.push(meta);
  }
  await fs.writeFile(APPS_FILE, JSON.stringify(list, null, 2));
}

export async function deleteApp(folder: string): Promise<boolean> {
  const list = await getAppList();
  const filtered = list.filter(p => p.folder !== folder);
  if (filtered.length === list.length) return false;
  await fs.writeFile(APPS_FILE, JSON.stringify(filtered, null, 2));
  return true;
}
