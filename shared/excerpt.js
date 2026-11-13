// A highlight quoted from a longer text, with "…" where it starts or ends partway through a
// sentence, so it reads as an excerpt and every word is still the writer's own.

/**
 * @param {string} text The whole text.
 * @param {string} part Words copied exactly from it.
 * @returns {string} The part, with "…" before it if it starts mid-sentence and after it if it
 *   doesn't end one.
 */
export function excerpt(text, part) {
  const at = text.indexOf(part);
  if (!part || at < 0) throw new Error(`not quoted word for word: ${part}`);
  const before = text.slice(0, at).trimEnd();
  const lead = before !== '' && !/[.!?]["”’)]?$/.test(before) ? '… ' : '';
  const trail = /[.!?]["”’)]?$/.test(part) ? '' : ' …';
  return lead + part + trail;
}
