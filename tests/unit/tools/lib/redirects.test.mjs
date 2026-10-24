// The old-domain redirects (redirects/old-domains.json): every listed case, and the rules' order.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import config from '../../../../redirects/old-domains.json' with { type: 'json' };
import { junk, match } from '../../../../tools/lib/redirects.mjs';
import { loadPosts } from '../../../../tools/lib/posts.mjs';

describe('redirect rules', () => {
  for (const [from, to] of config.tests) {
    it(`${from} → ${to}`, () => assert.equal(match(from)?.target, to));
  }

  it('sends every recovered blog post to its new page', () => {
    for (const post of loadPosts().filter((p) => p.original)) {
      assert.equal(match(post.original)?.target, `https://craigthompson.dev/blog/${post.slug}/`, post.original);
    }
  });

  it('keeps the rest of the path where a rule says so', () => {
    assert.equal(
      match('https://craigsworks.com/projects/simpletip/download/1.3.1/a.js')?.target,
      'https://cdn.jsdelivr.net/gh/Craga89/simpletip@master/download/1.3.1/a.js',
    );
  });

  it('leaves other domains alone', () => {
    assert.equal(match('https://example.com/'), null);
  });
});

describe('archived URLs', () => {
  it('skips strings the crawler picked out of old scripts', () => {
    assert.ok(junk("http://craigsworks.com/projects/qtip/'+s.id+'"));
    assert.ok(junk('http://craigsworks.com/a b'));
    assert.ok(!junk('http://craigsworks.com/projects/qtip/docs/'));
    assert.ok(!junk('http://craigsworks.com/?p=12'));
  });
});
