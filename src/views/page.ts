import fs from 'fs/promises';
import { marked } from 'marked';
import { layout, type NavSlug } from './layout.js';

interface MarkdownPageOptions {
  filePath: string;
  title: string;
  active: NavSlug;
}

export async function renderMarkdownPage({ filePath, title, active }: MarkdownPageOptions): Promise<string> {
  const md = await fs.readFile(filePath, 'utf-8');
  const html = marked.parse(md, { async: false }) as string;
  const content = `
  <main class="max-w-3xl mx-auto px-6 py-8">
    <article class="markdown-content">${html}</article>
  </main>`;
  return layout({ title, content, active });
}
