// Keyboard use, which automated rule engines can't check:
//   2.1.1 / 2.4.3  every control is reached with Tab, in a full lap of the page;
//   2.4.7          each one shows a visible focus indicator (its pixels change when focused);
//   2.4.11         none is hidden behind the sticky header or the chat bar when focused.
import { test, expect, settle } from './axe.mjs';

/**
 * @typedef {{ key: string, tag: string, name: string, rect: number[], hidden: number, inView: boolean }} Stop
 */

// The dark theme on a desktop, the light theme on a phone.
for (const [colorScheme, tag] of /** @type {const} */ ([['dark', '@desktop'], ['light', '@mobile']])) {
test.describe(`${colorScheme} theme`, { tag }, () => {
test.use({ colorScheme });

test('a full lap with Tab: every stop visibly focused and not hidden', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/');
  await settle(page);
  await page.mouse.move(1, 1);
  const viewport = page.viewportSize() || { width: 0, height: 0 };

  /** @type {(Stop & { focusVisible: boolean | null })[]} */
  const stops = [];
  for (let i = 0; i < 600; i++) {
    await page.keyboard.press('Tab');
    /** @type {Stop | { wrapped: true } | null} */
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const w = /** @type {any} */ (window);
      w.__seen = w.__seen || new WeakSet();
      if (w.__seen.has(el)) return { wrapped: true };
      w.__seen.add(el);
      const r = el.getBoundingClientRect();
      const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('title') || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50);
      // Sample points inside the element: hidden where another (non-ancestor) element is on top.
      const points = [[0.5, 0.5], [0.15, 0.25], [0.85, 0.25], [0.15, 0.75], [0.85, 0.75]].map(([fx, fy]) => [r.left + r.width * fx, r.top + r.height * fy]);
      let hidden = 0;
      for (const [x, y] of points) {
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) {
          hidden++;
          continue;
        }
        const hit = document.elementFromPoint(x, y);
        if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) hidden++;
      }
      return {
        key: `${el.tagName}|${el.id}|${name}|${Math.round(r.top + scrollY)}`,
        tag: el.tagName.toLowerCase(),
        name,
        rect: [r.left, r.top, r.width, r.height].map(Math.round),
        hidden,
        inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
      };
    });
    if (!info) continue;
    if ('wrapped' in info) break; // back to an element already visited: a full lap

    // Compare the focused element (with a margin for outlines and rings) with the same spot unfocused.
    const [x, y, w, h] = info.rect;
    const clip = { x: Math.max(0, x - 6), y: Math.max(0, y - 6), width: 0, height: 0 };
    clip.width = Math.min(w + 12, viewport.width - clip.x);
    clip.height = Math.min(h + 12, viewport.height - clip.y);
    let focusVisible = null;
    if (info.inView && clip.width > 2 && clip.height > 2) {
      const focused = await page.screenshot({ clip });
      await page.evaluate(() => {
        const w = /** @type {any} */ (window);
        w.__last = document.activeElement;
        w.__last?.blur();
      });
      const blurred = await page.screenshot({ clip });
      focusVisible = !focused.equals(blurred);
      // Put focus back (without a new visit) so the next Tab carries on from here.
      await page.evaluate(() => /** @type {any} */ (window).__last?.focus({ preventScroll: true, focusVisible: true }));
    }
    stops.push({ ...info, focusVisible });
  }

  expect(stops.length, 'focus stops in a lap').toBeGreaterThan(20);
  const describe = (/** @type {Stop} */ s) => `${s.tag} "${s.name}"`;
  expect.soft(stops.filter((s) => !s.inView).map(describe), '2.4.11: focused but off screen').toEqual([]);
  expect.soft(stops.filter((s) => s.inView && s.hidden === 5).map(describe), '2.4.11: hidden behind another element when focused').toEqual([]);
  expect.soft(stops.filter((s) => s.focusVisible === false).map(describe), '2.4.7: no visible focus indicator').toEqual([]);
  // Partly covered is allowed at AA (it fails AAA 2.4.12), so it's noted, not failed.
  const partly = stops.filter((s) => s.inView && s.hidden >= 3 && s.hidden < 5).map(describe);
  if (partly.length) test.info().annotations.push({ type: 'note', description: `partly covered when focused: ${partly.join(', ')}` });
});
});
}
