// What search-and-jump lists (scripts/palette.ts): the sections, every file and post, the FAQ,
// and actions. `path` is where an item goes; `action` is something the page does instead.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SECTIONS } from '../lib/sections';
import { caseStudies, responsibilities, slugOf } from '../lib/files';
import { posts } from '../lib/posts';
import { faqId, faqQuestions } from '../lib/faq';
import { EMAIL, GITHUB, LINKEDIN } from '../site';
import type { PaletteItem } from '../lib/palette';

const SECTION_WORDS: Record<string, string> = {
  top: 'intro about summary home readme',
  career: 'experience jobs history work employers',
  responsibilities: 'roles leadership',
  'case-studies': 'projects work',
  stack: 'skills tools technologies',
  oss: 'github pull requests contributions',
  blog: 'posts writing articles',
  recommendations: 'references testimonials',
  faq: 'questions',
  ask: 'ai question chat',
  contact: 'contact email hire talk get in touch',
};

export const GET: APIRoute = async () => {
  const items: PaletteItem[] = [];
  for (const s of SECTIONS)
    items.push({
      icon: '#',
      label: s.file,
      kind: 'section',
      path: s.id === 'top' ? '/' : `/#${s.id}`,
      kw: SECTION_WORDS[s.id],
    });
  for (const p of await posts())
    items.push({
      icon: '✎',
      label: p.data.title,
      kind: `post · ${p.data.date.getUTCFullYear()}`,
      path: `/blog/${p.slug}/`,
      kw: 'blog post ' + p.data.tags.join(' '),
    });
  items.push(
    { icon: '@', label: 'Copy email address', kind: 'action', action: 'email', kw: `contact mail email ${EMAIL}` },
    { icon: '↓', label: 'Download cv.pdf', kind: 'action', path: '/cv.pdf', kw: 'resume pdf' },
    { icon: '▤', label: 'Open the plain CV', kind: 'action', path: '/cv/', kw: 'resume' },
    {
      icon: '+',
      label: 'Add contact (contact.vcf)',
      kind: 'action',
      path: '/craig-thompson.vcf',
      kw: 'vcard address book',
    },
    { icon: '◐', label: 'Switch theme', kind: 'action', action: 'theme', kw: 'theme dark light mode colours' },
    { icon: '‖', label: 'Pause or play animations', kind: 'action', action: 'motion', kw: 'motion animation stop' },
    { icon: '↗', label: 'Share this page', kind: 'action', action: 'share', kw: 'send' },
    { icon: '⌨', label: 'Keyboard shortcuts', kind: 'action', action: 'keys', kw: 'keys help hotkeys' },
  );
  for (const f of await getCollection('focus'))
    items.push({
      icon: '→',
      label: `Suggested reading: ${f.data.label}`,
      kind: 'focus',
      path: `/?focus=${f.id}`,
      kw: `focus view ${f.id}`,
    });
  items.push(
    { icon: '↗', label: 'GitHub profile', kind: 'link', path: GITHUB, kw: 'craga89 code' },
    { icon: '↗', label: 'LinkedIn profile', kind: 'link', path: LINKEDIN, kw: 'linkedin' },
  );
  for (const r of await responsibilities())
    items.push({
      icon: '›',
      label: `responsibilities/${r.data.file}`,
      kind: 'responsibility',
      path: `/?resp=${r.data.id}#responsibilities`,
      page: `/responsibilities/${slugOf(r.data.file)}/`,
    });
  for (const c of await caseStudies())
    items.push({
      icon: '›',
      label: `case-studies/${c.data.file}`,
      kind: 'case study',
      path: `/?case=${c.data.id}#case-studies`,
      page: `/case-studies/${slugOf(c.data.file)}/`,
    });
  for (const q of await faqQuestions()) items.push({ icon: '?', label: q, kind: 'faq', path: `/#${faqId(q)}` });
  return new Response(JSON.stringify(items), { headers: { 'content-type': 'application/json' } });
};
