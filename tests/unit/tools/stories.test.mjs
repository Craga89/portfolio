// The component catalogue (/storybook): the examples copied from the content, and a story for
// every component, so a new component doesn't go missing from it.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { firstUse } from '../../../tools/stories.mjs';

const ROOT = new URL('../../../', import.meta.url).pathname;
/** @param {string} dir @param {string} ext @returns {string[]} */
const walk = (dir, ext) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p, ext) : p.endsWith(ext) ? [p] : [];
  });

describe('stories', () => {
  it('copies the first whole element, nesting and all, without its indent', () => {
    const text =
      'Intro\n\n  <Cards label="x">\n    <Card title="a">one</Card>\n    <Cards>\n      <Card title="b" />\n    </Cards>\n  </Cards>\n\n<Card title="c">c</Card>';
    assert.equal(
      firstUse(text, 'Cards'),
      '<Cards label="x">\n  <Card title="a">one</Card>\n  <Cards>\n    <Card title="b" />\n  </Cards>\n</Cards>',
    );
    assert.equal(firstUse(text, 'Card'), '<Card title="a">one</Card>');
  });

  it('copies a self-closing element, with > inside its attributes', () => {
    assert.equal(
      firstUse('<Route name="a" hops={[{ name: "b > c" }]} /> after', 'Route'),
      '<Route name="a" hops={[{ name: "b > c" }]} />',
    );
  });

  it("doesn't match a longer name, and finds nothing when unused", () => {
    assert.equal(firstUse('<Cards>x</Cards>', 'Card'), undefined);
    assert.equal(firstUse('nothing here', 'Card'), undefined);
  });

  it('has a story for every component', () => {
    // What each story renders: the component it imports from src/components, or the elements in
    // the example it imports. Not the wrappers' own imports (Mdx.astro's Job, say), which render
    // nothing unless a story's example uses them.
    /** @type {Set<string>} */
    const shown = new Set();
    for (const story of walk(join(ROOT, 'src/stories'), '.stories.ts')) {
      for (const [, path] of readFileSync(story, 'utf8').matchAll(/^import \w+ from '([^']+)';/gm)) {
        const p = resolve(dirname(story), path);
        if (p.includes('/src/components/')) shown.add(basename(p, '.astro'));
        else if (p.includes('/src/stories/examples/'))
          for (const [, n] of readFileSync(p, 'utf8').matchAll(/<([A-Z]\w*)[\s/>]/g)) shown.add(n);
      }
    }
    const missing = walk(join(ROOT, 'src/components'), '.astro')
      .map((p) => basename(p, '.astro'))
      .filter((n) => !shown.has(n));
    assert.deepEqual(
      missing,
      [],
      `no story shows: ${missing.join(', ')} (add one under src/stories, or run pnpm run stories)`,
    );
  });
});
