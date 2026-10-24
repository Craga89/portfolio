// An entry in search and jump (src/pages/palette.json.ts, scripts/palette.ts).
export interface PaletteItem {
  icon: string;
  label: string;
  kind: string;
  path?: string;
  /** A file's own page, where it goes from anywhere but the home page (which opens it in place). */
  page?: string;
  action?: 'email' | 'theme' | 'motion' | 'keys' | 'share';
  /** Extra words it's found by. */
  kw?: string;
}
