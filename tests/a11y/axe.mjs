// The accessibility tests' fixtures: the shared ones, plus `axe(label, include?)`, which runs every
// WCAG 2.0, 2.1 and 2.2 A and AA rule on the page as it is now. Each run is attached to the test
// (for the report, tests/reporters/a11y-report.mjs) and checked softly, so one test can audit
// several states and still report them all.
import { AxeBuilder } from '@axe-core/playwright';
import { test as base, expect } from '../fixtures.mjs';

export { expect, addStyle, settle, translated } from '../fixtures.mjs';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

/** An ask.sh answer, so audits see a conversation without spending the service's allowance. */
export const ANSWER = {
  status: 200,
  json: {
    answer:
      'Yes. He led engineering from start-up through to acquisition and represented engineering through due diligence. See acquisition.md, or email craga89@gmail.com.',
    sources: ['resp-acq', 'faq-13'],
    model: 'a11y-fixture',
  },
};

/** @typedef {(label: string, include?: string) => Promise<void>} Axe */

export const test = base.extend(
  /** @type {import('@playwright/test').Fixtures<{ axe: Axe }, {}, import('@playwright/test').PlaywrightTestArgs>} */ ({
    axe: async ({ page }, use, testInfo) => {
      await use(async (label, include) => {
        let builder = new AxeBuilder({ page }).withTags(TAGS);
        if (include) builder = builder.include(include);
        const results = await builder.analyze();
        const violations = results.violations.flatMap((v) =>
          v.nodes.map((n) => ({
            id: v.id,
            impact: v.impact ?? null,
            help: v.help,
            url: v.helpUrl,
            wcag: v.tags.filter((t) => /^wcag\d/.test(t)),
            target: n.target.join(' '),
            html: n.html.slice(0, 220),
            summary: (n.failureSummary || '').split('\n').slice(0, 3).join(' '),
          })),
        );
        await testInfo.attach('axe', { body: JSON.stringify({ label, violations }), contentType: 'application/json' });
        expect
          .soft(
            violations.map((v) => `${v.id}: ${v.help} (${v.target})`),
            `axe: ${label}`,
          )
          .toEqual([]);
      });
    },
  }),
);
