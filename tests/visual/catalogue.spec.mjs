// Every component on its own: each story in the component catalogue (/storybook) compared with its
// approved screenshot, in both themes, so a change to a component shows up as that component's
// diff, not a shifted page. A new story has nothing to compare with yet, so it's skipped until a
// commit on main with [visual] in its message approves its first screenshot (see ci.yml).
import { existsSync } from 'node:fs';
import { stories } from '../stories.mjs';
import { test, expect, addStyle, LIVE } from '../fixtures.mjs';

// The clock changes on its own; the catalogue's motion switch isn't part of any component.
const STEADY = '[data-clock]{visibility:hidden!important} .catalogue-motion{display:none!important}';

for (const scheme of /** @type {const} */ (['dark', 'light'])) {
  test.describe(`components, ${scheme}`, () => {
    test.use({ viewport: { width: 1100, height: 800 }, colorScheme: scheme });
    for (const s of stories()) {
      test(s.name, async ({ page }, info) => {
        const name = `component-${s.name}-${scheme}.png`;
        const updating = ['all', 'changed', 'missing'].includes(info.config.updateSnapshots);
        test.skip(
          !updating && !existsSync(info.snapshotPath(name, { kind: 'screenshot' })),
          'a new story: no approved screenshot yet',
        );
        await page.goto(s.path);
        await addStyle(page, STEADY);
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot(name, { fullPage: true, mask: [page.locator(LIVE)] });
      });
    }
  });
}
