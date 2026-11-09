// The static server used for prerendering and the end-to-end tests.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '../../../../tools/lib/serve.mjs';

describe('serve', () => {
  const dir = mkdtempSync(join(tmpdir(), 'serve-'));
  /** @type {Awaited<ReturnType<typeof serve>>} */
  let server;
  before(async () => {
    mkdirSync(join(dir, 'cv'));
    writeFileSync(join(dir, 'index.html'), '<h1>home</h1>');
    writeFileSync(join(dir, 'cv', 'index.html'), '<h1>cv</h1>');
    writeFileSync(join(dir, '404.html'), '<h1>missing</h1>');
    writeFileSync(join(dir, 'app.js'), 'export {}');
    server = await serve(dir);
  });
  after(() => server.close());

  it('serves files with their types, and index.html for directories', async () => {
    const home = await fetch(server.url);
    assert.equal(home.status, 200);
    assert.match(home.headers.get('content-type') || '', /^text\/html/);
    assert.equal(await (await fetch(server.url + 'cv/')).text(), '<h1>cv</h1>');
    assert.equal(await (await fetch(server.url + 'cv')).text(), '<h1>cv</h1>');
    assert.match((await fetch(server.url + 'app.js')).headers.get('content-type') || '', /^text\/javascript/);
  });

  it("answers anything missing with the site's 404 page", async () => {
    const r = await fetch(server.url + 'nope');
    assert.equal(r.status, 404);
    assert.equal(await r.text(), '<h1>missing</h1>');
  });

  it('never serves files outside the directory', async () => {
    const r = await fetch(server.url + '..%2f..%2fetc%2fpasswd');
    assert.ok(r.status === 403 || r.status === 404, String(r.status));
  });

  it("sends a _headers file's headers, overriding the file's type", async () => {
    const withHeaders = await serve(dir, 0, '/', '/*\n  X-Test: yes\n/app.js\n  Content-Type: text/x-test\n');
    try {
      assert.equal((await fetch(withHeaders.url)).headers.get('x-test'), 'yes');
      assert.equal((await fetch(withHeaders.url + 'app.js')).headers.get('content-type'), 'text/x-test');
      assert.equal((await fetch(withHeaders.url + 'nope')).headers.get('x-test'), null);
    } finally {
      withHeaders.close();
    }
  });

  it('points the speculation rules under the base path, and matches header rules within it', async () => {
    const sub = await serve(dir, 0, '/preview/x/', '/*\n  Speculation-Rules: "/rules.json"\n/cv/\n  X-Cv: yes\n');
    try {
      assert.equal((await fetch(sub.url)).headers.get('speculation-rules'), '"/preview/x/rules.json"');
      assert.equal((await fetch(sub.url + 'cv/')).headers.get('x-cv'), 'yes');
    } finally {
      sub.close();
    }
  });

  it('serves the site under a base path, and nothing outside it', async () => {
    const sub = await serve(dir, 0, '/preview/x');
    try {
      assert.match(sub.url, /\/preview\/x\/$/);
      assert.equal(await (await fetch(sub.url)).text(), '<h1>home</h1>');
      assert.equal(await (await fetch(sub.url + 'cv/')).text(), '<h1>cv</h1>');
      assert.equal(await (await fetch(sub.url.slice(0, -1))).text(), '<h1>home</h1>');
      const outside = await fetch(new URL('/cv/', sub.url));
      assert.equal(outside.status, 404);
    } finally {
      sub.close();
    }
  });
});
