// 1.4.10 Reflow: no sideways scrolling at 320 CSS px. 1.4.12 Text Spacing: no clipped text, and
// still no sideways scrolling, with the WCAG spacing overrides applied.
import { test, expect, settle, addStyle } from './axe.mjs';

test.use({ viewport: { width: 320, height: 640 }, colorScheme: 'light' });

const SPACING =
  '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';
/** @param {import('@playwright/test').Page} page */
const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

for (const path of ['/', 'cv/']) {
  test(`${path} at 320px: reflows, and survives text spacing`, { tag: '@mobile' }, async ({ page }) => {
    await page.goto(path);
    await settle(page);
    expect.soft(await sideways(page), '1.4.10: scrolls sideways (px)').toBeLessThanOrEqual(1);

    await addStyle(page, SPACING);
    const clipped = await page.evaluate(() => {
      /** @type {string[]} */
      const out = [];
      document.querySelectorAll('body *:not(script, style)').forEach((el) => {
        const cs = getComputedStyle(el);
        if (!el.childNodes.length || cs.display === 'none' || cs.visibility === 'hidden') return;
        if (![...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent || '').trim())) return;
        const clipX =
          /hidden|clip/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis';
        const clipY = /hidden|clip/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2;
        // 1px visually-hidden text (for screen readers) is clipped on purpose.
        if ((clipX || clipY) && el.clientWidth > 1 && el.clientHeight > 1) {
          out.push(
            `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''} "${(el.textContent || '').trim().slice(0, 40)}"`,
          );
        }
      });
      return out.slice(0, 10);
    });
    expect.soft(clipped, '1.4.12: text clipped').toEqual([]);
    expect.soft(await sideways(page), '1.4.12: scrolls sideways with text spacing (px)').toBeLessThanOrEqual(1);
  });
}
