// The FAQ's questions (src/content/sections/faq.mdx), and the id each one's disclosure has.
import { getEntry } from 'astro:content';

export const faqId = (q: string) =>
  'faq-' +
  q
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export async function faqQuestions(): Promise<string[]> {
  const faq = await getEntry('sections', 'faq');
  return [...(faq?.body ?? '').matchAll(/<Faq q="([^"]+)"/g)].map((m) => m[1]);
}
