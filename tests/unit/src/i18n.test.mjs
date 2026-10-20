// On-device translation: which language to offer, and checking a translation kept the markup.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fits, langName, LANGS, normalise, preferred } from '../../../src/i18n.js';

describe('languages', () => {
  it('reads browser language tags as the languages offered', () => {
    assert.equal(normalise('de-DE'), 'de');
    assert.equal(normalise('nb-NO'), 'no');
    assert.equal(normalise('iw'), 'he');
    assert.equal(normalise('zh-TW'), 'zh-Hant');
    assert.equal(normalise('zh-Hant-HK'), 'zh-Hant');
    assert.equal(normalise('tlh'), null);
    assert.equal(normalise(undefined), null);
    assert.ok(LANGS.includes('ar'));
  });

  it("offers the visitor's first language, unless English comes first", () => {
    assert.equal(preferred(['de-DE', 'en-GB']), 'de');
    assert.equal(preferred(['en-GB', 'de-DE']), null);
    assert.equal(preferred(['tlh', 'fr-CA', 'en']), 'fr');
    assert.equal(preferred(undefined), null);
  });

  it("names a language in its own words, or another language's", () => {
    assert.equal(langName('de'), 'Deutsch');
    assert.equal(langName('de', 'en'), 'German');
    assert.equal(langName('not a code'), 'not a code');
  });
});

describe('fits: does a translation keep the markup?', () => {
  // "Read {0}the file{/0} or {1}" — a link around "the file", then an atomic element.
  const meta = { nodes: [{}, {}], parent: [-1, -1], paired: [true, false] };
  const m = /** @type {any} */ (meta);

  it('accepts the same tokens, moved around', () => {
    assert.ok(fits('Lies {0}die Datei{/0} oder {1}', m));
    assert.ok(fits('{1} oder {0}die Datei{/0} lesen', m));
  });

  it('rejects lost, repeated, unknown or broken tokens', () => {
    assert.ok(!fits('Lies die Datei oder {1}', m));
    assert.ok(!fits('{0}a{/0} {0}b{/0} {1}', m));
    assert.ok(!fits('{0}a{/0} {1} {2}', m));
    assert.ok(!fits('{0}a {1}', m));
    assert.ok(!fits('{/0}a{0} {1}', m));
  });

  it('checks nesting', () => {
    // {0}…{1}…{/1}…{/0}: token 1 lives inside token 0.
    const nested = /** @type {any} */ ({ nodes: [{}, {}], parent: [-1, 0], paired: [true, true] });
    assert.ok(fits('{0}x {1}y{/1}{/0}', nested));
    assert.ok(!fits('{0}x{/0} {1}y{/1}', nested));
  });
});
