// The site: static HTML from src/pages, written to site/ (what CI tests and deploys).
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { createHash } from 'node:crypto';
import { satteri } from '@astrojs/markdown-satteri';
import { postBuild } from './integrations/post-build.mjs';
import { baseLinks, codeBlocks } from './integrations/markdown.mjs';
import { INLINE_SCRIPTS, NAV_CSS } from './src/scripts/inline.mjs';

/** @param {string} s @returns {`sha256-${string}`} */
const sha256 = (s) => `sha256-${createHash('sha256').update(s).digest('base64')}`;

const base = process.env.PREVIEW_BASE || '/';

export default defineConfig({
  site: 'https://craigthompson.dev',
  outDir: './site',
  // A preview of a branch is built to live under /preview/<branch>/ (see .github/workflows/preview.yml).
  base,
  trailingSlash: 'always',
  build: { format: 'directory', assets: 'assets' },
  // Every page gets a Content-Security-Policy with hashes for its own scripts and styles.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "media-src 'self' blob: data:",
        "connect-src 'self' https://*.workers.dev https://cloudflareinsights.com",
        "object-src 'none'",
        "base-uri 'self'",
      ],
      // static.cloudflareinsights.com and cloudflareinsights.com: the Web Analytics beacon, which
      // Cloudflare adds to each page as it serves it (automatic setup).
      scriptDirective: {
        resources: ["'self'", 'https://static.cloudflareinsights.com'],
        hashes: INLINE_SCRIPTS.map(sha256),
      },
      styleDirective: { hashes: [sha256(NAV_CSS)] },
    },
  },
  markdown: { syntaxHighlight: false, processor: satteri({ hastPlugins: [codeBlocks, baseLinks(base)] }) },
  compressHTML: true,
  integrations: [
    mdx(),
    sitemap({ filter: (page) => !page.endsWith('/404/') && !page.includes('/og-card/') }),
    postBuild(),
  ],
  vite: {
    build: { assetsInlineLimit: 0 },
    // Astro's prerenderer needs cookie 2, but another dev dependency puts cookie 0.7 at the top of
    // node_modules; bundling it resolves the right one.
    environments: { prerender: { resolve: { noExternal: ['cookie'] } } },
  },
});
