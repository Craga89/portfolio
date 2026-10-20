// The site's files: every case study and responsibility, with the page each one has.
import { getCollection, type CollectionEntry } from 'astro:content';

export type FileKind = 'case' | 'resp';
export interface SiteFile {
  kind: FileKind;
  /** The short id used by tabs and links (mono, lead…). */
  id: string;
  /** The file name shown on the site (monorepo.md, ai/platform.md…). */
  file: string;
  title: string;
  /** The file's own page, from the site root (case-studies/monorepo/). */
  page: string;
  /** The home page section it's in. */
  section: 'case-studies' | 'responsibilities';
}

/** A file name as the build names its page: ai/platform.md → ai-platform. */
export const slugOf = (file: string) => file.replace(/\.md$/, '').replace(/\//g, '-');

const caseFile = (e: CollectionEntry<'caseStudies'>): SiteFile => ({
  kind: 'case',
  id: e.data.id,
  file: e.data.file,
  title: e.data.title,
  page: `case-studies/${slugOf(e.data.file)}/`,
  section: 'case-studies',
});
const respFile = (e: CollectionEntry<'responsibilities'>): SiteFile => ({
  kind: 'resp',
  id: e.data.id,
  file: e.data.file,
  title: e.data.title,
  page: `responsibilities/${slugOf(e.data.file)}/`,
  section: 'responsibilities',
});

export const caseStudies = async () => (await getCollection('caseStudies')).sort((a, b) => a.data.order - b.data.order);
export const responsibilities = async () => (await getCollection('responsibilities')).sort((a, b) => a.data.order - b.data.order);

/** Every file, case studies first, each in its tab order. */
export async function allFiles(): Promise<SiteFile[]> {
  return [...(await caseStudies()).map(caseFile), ...(await responsibilities()).map(respFile)];
}

/** A file by its name (compliance.md) or by kind and id (resp/comp). */
export async function findFile(ref: string): Promise<SiteFile> {
  const files = await allFiles();
  const found = ref.includes('/') && !ref.endsWith('.md') ? files.find((f) => `${f.kind}/${f.id}` === ref) : files.find((f) => f.file === ref);
  if (!found) throw new Error(`No case study or responsibility "${ref}"`);
  return found;
}
