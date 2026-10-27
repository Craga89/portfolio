// Markdown output tweaks for the blog posts (src/content/blog).
import { defineHastPlugin } from 'satteri';

/**
 * Code blocks: focusable, so a long line can be scrolled by keyboard (WCAG 2.1.1), left out of
 * page translation, and labelled with their language.
 */
export const codeBlocks = defineHastPlugin({
  name: 'code-blocks',
  element: {
    filter: ['pre'],
    visit(node, ctx) {
      ctx.setProperty(node, 'tabIndex', 0);
      ctx.setProperty(node, 'translate', 'no');
      const code = node.children.find((c) => c.type === 'element' && c.tagName === 'code');
      const cls = code && code.type === 'element' ? code.properties?.className : undefined;
      const lang = Array.isArray(cls) ? cls.map(String).find((c) => c.startsWith('language-')) : undefined;
      if (lang) ctx.setProperty(node, 'dataLang', lang.slice(9));
    },
  },
});

/**
 * Links to the site's own pages ("/blog/…/", "/cv/") under the site's base, so they work in a
 * branch preview (served from /preview/<branch>/) as well as on the live site.
 * @param {string} base the site's base, ending in "/"
 */
export const baseLinks = (base) =>
  defineHastPlugin({
    name: 'base-links',
    element: {
      filter: ['a', 'img'],
      visit(node, ctx) {
        if (base === '/') return;
        for (const prop of ['href', 'src']) {
          const v = node.properties?.[prop];
          if (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') && !v.startsWith(base))
            ctx.setProperty(node, prop, base + v.slice(1));
        }
      },
    },
  });
