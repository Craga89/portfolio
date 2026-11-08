// Every component on its own: axe on each story in the component catalogue (/storybook), in both
// themes. A page audit names the page; this names the component, and covers the states and
// variants a page doesn't show (an open dialog, each block tone, both case-study cards).
import { stories } from '../stories.mjs';
import { test, settle } from './axe.mjs';

for (const scheme of /** @type {const} */ (['dark', 'light'])) {
  test.describe(`components, ${scheme} @desktop`, () => {
    test.use({ colorScheme: scheme });
    for (const s of stories()) {
      test(s.name, async ({ page, axe }) => {
        await page.goto(s.path);
        await settle(page);
        await page.evaluate(() => document.fonts.ready);
        await axe(`component ${s.name} (${scheme})`);
      });
    }
  });
}
