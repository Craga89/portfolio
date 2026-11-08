// The component catalogue's stories (/storybook, src/stories), listed from the built site: each
// story's own page, which shows the story alone, without Astrobook's sidebar.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SITE = new URL('../site/', import.meta.url).pathname;
const ROOT = join(SITE, 'storybook/stories');

/** @returns {{ name: string, path: string }[]} the story's name (group-file-story) and its address */
export function stories() {
  if (!existsSync(ROOT)) throw new Error('No component catalogue in site/: run pnpm run build first');
  /** @type {{ name: string, path: string }[]} */
  const out = [];
  /** @param {string} dir */
  const walk = (dir) => {
    for (const n of readdirSync(dir).sort()) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n === 'index.html') {
        const rel = dir.slice(ROOT.length + 1);
        out.push({ name: rel.replaceAll('/', '-'), path: `storybook/stories/${rel}/` });
      }
    }
  };
  walk(ROOT);
  return out;
}
