// The blog posts in src/blog/: front matter the build and the redirects rely on.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BLOG, listing, loadPosts } from '../../../tools/blog.mjs';

const posts = loadPosts();

describe('blog posts', () => {
  it('are there, newest first', () => {
    assert.ok(posts.length > 8);
    const dates = posts.map((p) => p.date);
    assert.deepEqual(dates, [...dates].sort().reverse());
  });

  for (const p of posts) {
    it(`${p.slug}: title, date, original address, summary and images`, () => {
      assert.match(p.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
      assert.ok(p.title && p.title !== p.slug + '.md', 'has a title');
      assert.match(p.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(Array.isArray(p.tags));
      if (p.original) assert.match(p.original, /^https?:\/\/(blog\.)?craigsworks\.com\//);
      assert.ok(p.summary.length > 20 && p.summary.length <= 260, 'summary length ' + p.summary.length);
      assert.ok(p.minutes >= 1);
      for (const [, img] of p.md.matchAll(/!\[[^\]]*\]\(img\/([^)\s]+)\)/g))
        assert.ok(existsSync(join(BLOG, 'img', img)), 'img/' + img);
    });
  }

  it('the home page listing has only what it shows', () => {
    assert.deepEqual(Object.keys(listing(posts)[0]).sort(), ['date', 'minutes', 'slug', 'tags', 'title']);
  });
});
