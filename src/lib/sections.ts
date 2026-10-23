// The home page's sections, in order, as the explorer and the menu list them.
export interface Section {
  id: string;
  file: string;
  /** A folder (shown with a filled dot) rather than a single file. */
  dir?: boolean;
}

export const SECTIONS: Section[] = [
  { id: 'top', file: 'README.md' },
  { id: 'career', file: 'career.log' },
  { id: 'responsibilities', file: 'responsibilities/', dir: true },
  { id: 'case-studies', file: 'case-studies/', dir: true },
  { id: 'stack', file: 'stack/', dir: true },
  { id: 'oss', file: 'open-source/', dir: true },
  { id: 'blog', file: 'blog/', dir: true },
  { id: 'recommendations', file: 'recommendations.txt' },
  { id: 'faq', file: 'faq.md' },
  { id: 'ask', file: 'ask.sh' },
  { id: 'contact', file: 'get-in-touch.md' },
];
