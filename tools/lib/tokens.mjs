// The design tokens (src/styles/tokens.css), read as data: each theme's colours, and the WCAG
// contrast between two of them. Used by the token stories (src/stories/tokens) and the contrast
// test (tests/unit/tools/lib/tokens.test.mjs).

/**
 * The colour tokens of each theme, by name (without the leading --). A theme without its own value
 * for a token (the light theme's heatmap's first step, say) takes the dark theme's, as the CSS does.
 * @param {string} css
 * @returns {Record<'dark' | 'light' | 'dark-more' | 'light-more' | 'print', Record<string, string>>}
 */
export function themes(css) {
  /** @param {string} body */
  const read = (body) =>
    Object.fromEntries(
      [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,8}|rgb\([^)]*\)|transparent)\s*;/gi)].map((m) => [m[1], m[2]]),
    );
  /** @param {RegExp} re */
  const block = (re) => {
    const m = re.exec(css);
    return m ? read(m[1]) : {};
  };
  const more = /@media \(prefers-contrast: more\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  const dark = block(/^:root \{([\s\S]*?)^\}/m);
  const light = { ...dark, ...block(/^:root\[data-theme='light'\] \{([\s\S]*?)^\}/m) };
  return {
    dark,
    light,
    'dark-more': { ...dark, ...read(/:root \{([\s\S]*?)\}/.exec(more)?.[1] ?? '') },
    'light-more': { ...light, ...read(/:root\[data-theme='light'\] \{([\s\S]*?)\}/.exec(more)?.[1] ?? '') },
    print: { ...light, ...block(/@media print \{[^{]*\{([\s\S]*?)\n {2}\}/) },
  };
}

/** @param {string} hex @returns {[number, number, number]} */
export function rgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return [r, g, b];
}

/** WCAG 2 relative luminance. @param {string} hex */
export function luminance(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG 2 contrast ratio of two colours, from 1 to 21. @param {string} a @param {string} b */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The tokens text is set in, and the backgrounds it's set on. */
export const TEXT = [
  'head',
  'text',
  'text2',
  'text3',
  'mute',
  'mute2',
  'dim',
  'acc',
  'acc-h',
  'ok',
  'ok-text',
  'bad',
  'blue',
  'lilac',
];
export const SURFACES = ['bg', 'panel', 'panel2'];
