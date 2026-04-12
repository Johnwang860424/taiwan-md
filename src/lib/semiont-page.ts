/**
 * semiont-page.ts — Shared utility for rendering semiont cognitive layer markdown files.
 * Used by /semiont/manifesto, /semiont/consciousness, /semiont/longings, etc.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { marked } from 'marked';

const SEMIONT_DIR = resolve(process.cwd(), 'docs/semiont');

function createRenderer(): marked.Renderer {
  const renderer = new marked.Renderer();

  renderer.heading = ({ text, depth }) => {
    const id = text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u4e00-\u9fff-]/g, '')
      .slice(0, 60);
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };

  renderer.link = ({ href, title, text }) => {
    const isExternal =
      href?.startsWith('http://') || href?.startsWith('https://');
    const titleAttr = title ? ` title="${title}"` : '';
    const targetAttr = isExternal
      ? ' target="_blank" rel="noopener noreferrer"'
      : '';
    // Convert internal semiont doc links to web routes
    let resolvedHref = href || '';
    if (
      resolvedHref.endsWith('.md') &&
      !isExternal &&
      !resolvedHref.startsWith('/')
    ) {
      // e.g. "DIARY.md" → "/semiont/diary", "CONSCIOUSNESS.md" → "/semiont/consciousness"
      const name = resolvedHref
        .replace(/\.md$/, '')
        .toLowerCase()
        .replace(/_/g, '-');
      const routeMap: Record<string, string> = {
        manifesto: '/semiont/manifesto',
        consciousness: '/semiont/consciousness',
        longings: '/semiont/longings',
        unknowns: '/semiont/unknowns',
        anatomy: '/semiont/anatomy',
        heartbeat: '/semiont/heartbeat',
        dna: '/semiont/dna',
        diary: '/semiont/diary',
        memory: '/semiont', // no dedicated memory page yet
        'organ-lifecycle': '/semiont/anatomy',
        crons: '/semiont/heartbeat',
        'session-scope': '/semiont/heartbeat',
      };
      resolvedHref = routeMap[name] || resolvedHref;
    }
    return `<a href="${resolvedHref}"${titleAttr}${targetAttr}>${text}</a>`;
  };

  return renderer;
}

export interface SemiontPage {
  /** Raw markdown content */
  markdown: string;
  /** Rendered HTML */
  html: string;
  /** First H1 title extracted */
  title: string;
  /** First paragraph or blockquote as subtitle */
  subtitle: string;
  /** Extracted h2/h3 headings for TOC */
  headings: { level: number; text: string; id: string }[];
  /** Word count */
  wordCount: number;
}

export async function loadSemiontPage(filename: string): Promise<SemiontPage> {
  const filePath = resolve(SEMIONT_DIR, filename);
  const raw = await readFile(filePath, 'utf-8');

  // Extract title from first H1
  const titleMatch = raw.match(/^#\s+(.+?)(?:\s*—.*)?$/m);
  const title = titleMatch ? titleMatch[1].trim() : filename.replace('.md', '');

  // Extract subtitle from first blockquote after H1
  const subtitleMatch = raw.match(
    /^#\s+.+\n+>\s*相關：.+\n+(?:---\n+)?(?:>\s*)?(.+)/m,
  );
  const subtitle = subtitleMatch ? subtitleMatch[1].trim() : '';

  // Remove H1 and the "相關" blockquote for body rendering
  let body = raw;
  // Remove the H1 line
  body = body.replace(/^#\s+.+$/m, '');
  // Remove the "相關" navigation blockquote (first blockquote starting with "> 相關")
  body = body.replace(/^>\s*相關：.+$/m, '');

  const renderer = createRenderer();
  const html = marked.parse(body, { renderer, breaks: true }) as string;

  // Extract headings from rendered HTML
  const headings: { level: number; text: string; id: string }[] = [];
  const regex = /<h([23])[^>]*(?:id="([^"]*)")?[^>]*>(.*?)<\/h\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const existingId = match[2];
    const rawText = match[3].replace(/<[^>]+>/g, '').trim();
    const id =
      existingId ||
      rawText
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u4e00-\u9fff-]/g, '')
        .slice(0, 60);
    if (rawText) headings.push({ id, text: rawText, level });
  }

  const wordCount = raw
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#*_>`\-|]/g, '')
    .replace(/\n/g, '').length;

  return { markdown: raw, html, title, subtitle, headings, wordCount };
}
