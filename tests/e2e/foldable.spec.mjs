// Foldables, half-open: nothing sits across the fold. Chrome's DevTools protocol stands in for the
// device, splitting a Galaxy Z Fold-sized screen (882×1104 CSS px open) into two segments.
import { test, expect } from '../fixtures.mjs';

const W = 882;
const H = 1104;

/**
 * Emulates a fold down the middle of the screen: 'vertical' for book posture (side by side) or
 * 'horizontal' for tabletop (one above the other).
 * @param {import('@playwright/test').Page} page
 * @param {'vertical' | 'horizontal'} orientation
 */
async function fold(page, orientation) {
  const [width, height] = orientation === 'vertical' ? [W, H] : [H, W];
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
    displayFeature: { orientation, offset: (orientation === 'vertical' ? width : height) / 2, maskLength: 0 },
    devicePosture: { type: 'folded' },
  });
  return orientation === 'vertical' ? width / 2 : height / 2;
}

/** @param {import('@playwright/test').Locator} el */
const box = async (el) => (await el.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };

test('book posture: the page on one side of the fold, the sidebar and ask.sh on the other @desktop', async ({
  page,
}) => {
  await page.goto('/');
  const crease = await fold(page, 'vertical');
  await expect.poll(() => page.evaluate(() => matchMedia('(horizontal-viewport-segments: 2)').matches)).toBe(true);

  const main = await box(page.locator('main'));
  expect(main.x + main.width).toBeLessThanOrEqual(crease);
  const side = await box(page.locator('aside.side'));
  expect(side.x).toBeGreaterThanOrEqual(crease);

  // ask.sh opens by itself, docked under the sidebar, and doesn't take focus.
  const chat = page.locator('[data-chat]');
  await expect(chat).toHaveAttribute('data-open', 'true');
  const c = await box(chat);
  expect(c.x).toBeGreaterThanOrEqual(crease);
  expect(c.x + c.width).toBeLessThanOrEqual(W);
  await expect(page.locator('#c-chat-field')).not.toBeFocused();

  // The sections lay out for the width of their page, so nothing scrolls sideways.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(W);
});

test('tabletop: ask.sh takes the lower half, and the page can be read to its end above it @desktop', async ({
  page,
}) => {
  await page.goto('/');
  const crease = await fold(page, 'horizontal');
  const chat = page.locator('[data-chat]');
  await expect(chat).toHaveAttribute('data-open', 'true');
  const c = await box(chat);
  expect(c.y).toBeGreaterThanOrEqual(crease - 1);
  expect(c.width).toBe(H);

  const last = page.locator('main > :last-child');
  await expect
    .poll(async () => {
      await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
      const b = await box(last);
      return b.y + b.height;
    })
    .toBeLessThanOrEqual(crease);
});

test('other pages: the page on one side of the fold and the header on the other @desktop', async ({ page }) => {
  await page.goto('/case-studies/accessibility/');
  const crease = await fold(page, 'vertical');
  await expect.poll(async () => (await box(page.locator('header.top'))).x).toBeGreaterThanOrEqual(crease);
  const main = await box(page.locator('main'));
  expect(main.x + main.width).toBeLessThanOrEqual(crease);
});
