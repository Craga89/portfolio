// The site: static HTML from src/pages, written to site/ (what CI tests and deploys).
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { createHash } from 'node:crypto';
import { postBuild } from './integrations/post-build.mjs';
import { INLINE_SCRIPTS } from './src/scripts/inline.mjs';

const sha256 = (s) => `sha256-${createHash('sha256').update(s).digest('base64')}`;

// Search engines stay out until the content is finished: build with ALLOW_INDEXING=true to open up.
const indexing = process.env.ALLOW_INDEXING === 'true';

export default defineConfig({
  site: 'https://craigthompson.dev',
  outDir: './site',
  trailingSlash: 'always',
  build: { format: 'directory', assets: 'assets' },
  // Every page gets a Content-Security-Policy with hashes for its own scripts and styles.
  security: {
    csp: {
      directives: ["default-src 'self'", "img-src 'self' data:", "connect-src 'self' https://*.workers.dev https://cloudflareinsights.com", "object-src 'none'", "base-uri 'self'"],
      scriptDirective: { resources: ["'self'", 'https://static.cloudflareinsights.com'], hashes: INLINE_SCRIPTS.map(sha256) },
    },
  },
  markdown: { syntaxHighlight: false },
  compressHTML: true,
  integrations: [mdx(), sitemap({ filter: (page) => !page.endsWith('/404/') }), postBuild({ indexing })],
  vite: {
    build: { assetsInlineLimit: 0 },
    // Astro's prerenderer needs cookie 2, but another dev dependency puts cookie 0.7 at the top of
    // node_modules; bundling it resolves the right one.
    environments: { prerender: { resolve: { noExternal: ['cookie'] } } },
  },
});
