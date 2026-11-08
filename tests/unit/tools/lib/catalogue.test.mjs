// The component catalogue's pages: their CSP allows inline code, and nothing else changes.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { relaxCatalogue, relaxCsp } from '../../../../tools/lib/catalogue.mjs';

const meta = (/** @type {string} */ policy) =>
  `<head><meta http-equiv="content-security-policy" content="${policy}"></head>`;

describe('catalogue', () => {
  it("swaps the script and style hashes for 'unsafe-inline', and keeps the rest", () => {
    assert.equal(
      relaxCsp(
        meta(
          "default-src 'self';script-src 'self' https://a.dev 'sha256-abc=';style-src 'self' 'sha256-def=';object-src 'none'",
        ),
      ),
      meta(
        "default-src 'self';script-src 'self' https://a.dev 'unsafe-inline';style-src 'self' 'unsafe-inline';object-src 'none'",
      ),
    );
  });

  it('leaves a page without a policy alone', () => {
    assert.equal(relaxCsp('<head></head>'), '<head></head>');
  });

  it('changes only the pages under the catalogue', () => {
    const out = mkdtempSync(join(tmpdir(), 'catalogue-'));
    mkdirSync(join(out, 'storybook/stories/a'), { recursive: true });
    const page = meta("script-src 'self' 'sha256-x='");
    writeFileSync(join(out, 'index.html'), page);
    writeFileSync(join(out, 'storybook/index.html'), page);
    writeFileSync(join(out, 'storybook/stories/a/index.html'), page);
    assert.equal(relaxCatalogue(out), 2);
    assert.equal(readFileSync(join(out, 'index.html'), 'utf8'), page);
    assert.match(
      readFileSync(join(out, 'storybook/stories/a/index.html'), 'utf8'),
      /script-src 'self' 'unsafe-inline'/,
    );
    assert.equal(relaxCatalogue(join(out, 'missing')), 0);
  });
});
