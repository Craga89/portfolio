// The design tokens' colours: every text colour readable on every surface, in every theme
// (WCAG 1.4.3, 4.5:1), so a token change can't quietly drop below it anywhere on the site.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SURFACES, TEXT, contrast, luminance, rgb, themes } from '../../../../tools/lib/tokens.mjs';

const css = readFileSync(new URL('../../../../src/styles/tokens.css', import.meta.url), 'utf8');

describe('tokens', () => {
  it('reads each theme, with the overrides on top of the theme they change', () => {
    const t = themes(css);
    assert.equal(t.light.bg, '#e2eee8');
    assert.equal(t.light.hm0, 'transparent', 'taken from the dark theme');
    assert.equal(t['dark-more'].dim, '#c9d8cf');
    assert.equal(t['dark-more'].bg, t.dark.bg);
    assert.equal(t['light-more'].line, '#6f8577');
    assert.equal(t.print.bg, '#ffffff');
    assert.equal(t.print.lilac, t.light.lilac);
  });

  it('works out WCAG contrast', () => {
    assert.deepEqual(rgb('#fff'), [255, 255, 255]);
    assert.equal(luminance('#000000'), 0);
    assert.equal(contrast('#000000', '#ffffff'), 21);
    assert.equal(contrast('#ffffff', '#000000'), 21);
    assert.equal(contrast('#777777', '#777777'), 1);
  });

  it('has every text colour at 4.5:1 or more on every surface, in every theme', () => {
    const low = Object.entries(themes(css)).flatMap(([theme, t]) =>
      TEXT.flatMap((fg) =>
        SURFACES.map((bg) => ({ theme, fg, bg, ratio: contrast(t[fg], t[bg]) }))
          .filter((p) => !(p.ratio >= 4.5))
          .map((p) => `${p.theme}: --${p.fg} on --${p.bg} is ${p.ratio.toFixed(2)}:1`),
      ),
    );
    assert.deepEqual(low, []);
  });
});
