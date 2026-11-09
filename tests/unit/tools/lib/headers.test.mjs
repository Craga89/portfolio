// Cloudflare's _headers file, as the local server applies it.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { headersFor, parseHeaders } from '../../../../tools/lib/headers.mjs';

describe('headers', () => {
  const rules = parseHeaders(`# a comment
/*
  X-One: a
  ! X-Removed

https://:sub.example.workers.dev/*
  X-Host: skipped

/files/:name.json
  Content-Type: application/x-test
/files/*
  X-One: b
`);

  it('applies every matching rule, joining a header set twice', () => {
    assert.deepEqual(headersFor(rules, '/'), { 'x-one': 'a' });
    assert.deepEqual(headersFor(rules, '/files/a.json'), {
      'x-one': 'a, b',
      'content-type': 'application/x-test',
    });
  });

  it('matches a placeholder within one segment only, and skips host patterns', () => {
    assert.equal(headersFor(rules, '/files/a/b.json')['content-type'], undefined);
    assert.equal(headersFor(rules, '/files/a.jsonx')['content-type'], undefined);
    assert.ok(rules.every((r) => r.headers.every(([k]) => k !== 'x-host' && !k.startsWith('!'))));
  });

  it("reads the site's own file: speculation rules everywhere, and the downloads kept out of search", () => {
    const site = parseHeaders(readFileSync(new URL('../../../../cloudflare/_headers', import.meta.url), 'utf8'));
    assert.equal(headersFor(site, '/cv/')['speculation-rules'], '"/speculation-rules.json"');
    assert.equal(headersFor(site, '/speculation-rules.json')['content-type'], 'application/speculationrules+json');
    assert.equal(headersFor(site, '/cv.json')['x-robots-tag'], 'noindex');
    assert.equal(headersFor(site, '/craig-thompson.vcf')['x-robots-tag'], 'noindex');
    assert.equal(headersFor(site, '/cv/')['x-robots-tag'], undefined);
  });
});
