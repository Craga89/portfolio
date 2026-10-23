// An entry in search and jump (src/pages/palette.json.ts, scripts/palette.ts).
export interface PaletteItem {
  icon: string;
  label: string;
  kind: string;
  path?: string;
  action?: 'email' | 'theme' | 'motion' | 'keys' | 'share';
  /** Extra words it's found by. */
  kw?: string;
}
