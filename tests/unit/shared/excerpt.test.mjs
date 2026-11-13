// A recommendation's highlight: "…" only where it cuts into a sentence.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { excerpt } from '../../../shared/excerpt.js';

const text = 'He is great. Honestly, he is the main reason I stayed. Any team would be lucky.';

describe('excerpt', () => {
  it('leaves a whole sentence as it is', () => {
    assert.equal(excerpt(text, 'He is great.'), 'He is great.');
    assert.equal(
      excerpt(text, 'Honestly, he is the main reason I stayed.'),
      'Honestly, he is the main reason I stayed.',
    );
  });

  it('marks a start or an end that falls mid-sentence', () => {
    assert.equal(excerpt(text, 'he is the main reason I stayed.'), '… he is the main reason I stayed.');
    assert.equal(excerpt(text, 'Any team would be lucky'), 'Any team would be lucky …');
    assert.equal(excerpt(text, 'the main reason'), '… the main reason …');
  });

  it('counts a sentence ending in a quote mark or bracket as ended', () => {
    assert.equal(excerpt('He said “yes.” Then he left.', 'Then he left.'), 'Then he left.');
  });

  it('refuses words that are not in the text', () => {
    assert.throws(() => excerpt(text, 'he is the reason'), /word for word/);
    assert.throws(() => excerpt(text, ''), /word for word/);
  });
});
