// The component catalogue's pages: their inline scripts are allowed by hash (never 'unsafe-inline'),
// their inline styles allowed, and nothing outside the catalogue changes.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogueCsp, inlineScriptHashes, secureCatalogue } from '../../../../tools/lib/catalogue.mjs';

const meta = (/** @type {string} */ policy) => `<meta http-equiv="content-security-policy" content="${policy}">`;
const hash = (/** @type {string} */ s) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`;

describe('catalogue', () => {
  it('hashes inline scripts, not external ones or empty ones', () => {
    const html =
      '<script>a()</script><script type="module" src="/x.js"></script><script></script><script type="module">b()</script>';
    assert.deepEqual(inlineScriptHashes(html), [hash('a()'), hash('b()')]);
  });

  it("adds the page's script hashes, never 'unsafe-inline', and allows inline styles", () => {
    const html = `<head>${meta("default-src 'self';script-src 'self' 'sha256-old=';style-src 'self' 'sha256-css=';object-src 'none'")}<script>run()</script></head>`;
    const policy = /content="([^"]*)"/.exec(catalogueCsp(html))?.[1] ?? '';
    assert.equal(
      policy,
      `default-src 'self';script-src 'self' 'sha256-old=' ${hash('run()')};style-src 'self' 'unsafe-inline';object-src 'none'`,
    );
    assert.doesNotMatch(policy.split(';').find((d) => d.startsWith('script-src')) ?? '', /unsafe-inline/);
  });

  it('leaves a page without a policy alone', () => {
    assert.equal(catalogueCsp('<head><script>x()</script></head>'), '<head><script>x()</script></head>');
  });

  it('changes only the pages under the catalogue', () => {
    const out = mkdtempSync(join(tmpdir(), 'catalogue-'));
    mkdirSync(join(out, 'storybook/stories/a'), { recursive: true });
    const page = `${meta("script-src 'self';style-src 'self' 'sha256-x='")}<script>x()</script>`;
    writeFileSync(join(out, 'index.html'), page);
    writeFileSync(join(out, 'storybook/index.html'), page);
    writeFileSync(join(out, 'storybook/stories/a/index.html'), page);
    assert.equal(secureCatalogue(out), 2);
    assert.equal(readFileSync(join(out, 'index.html'), 'utf8'), page);
    assert.match(
      readFileSync(join(out, 'storybook/stories/a/index.html'), 'utf8'),
      new RegExp(`script-src 'self' ${hash('x()').replace(/[+/=]/g, '\\$&')}`),
    );
    assert.equal(secureCatalogue(join(out, 'missing')), 0);
  });
});
