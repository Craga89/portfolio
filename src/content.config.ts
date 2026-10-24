// The site's content: what each kind of file holds, checked when the site builds.
import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

/** A responsibility: the summary the tour shows, and the full file (the MDX body). */
const responsibilities = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/responsibilities', generateId: ({ data }) => String(data.id) }),
  schema: z.object({
    id: z.string(),
    order: z.number().int(),
    file: z.string().regex(/^[\w-]+\.md$/),
    group: z.enum(['team', 'business', 'organisation']),
    kicker: z.string(),
    title: z.string(),
    lede: z.string(),
    points: z.array(z.string()).min(1),
    stat: z.object({ value: z.coerce.string(), label: z.string() }),
    flow: z.object({ label: z.string(), steps: z.array(z.string()).min(2) }),
  }),
});

/** A case study: the heading here, the rest in the MDX body. */
const caseStudies = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/case-studies', generateId: ({ data }) => String(data.id) }),
  schema: z.object({
    id: z.string(),
    order: z.number().int(),
    file: z.string().regex(/^[\w/-]+\.md$/),
    kicker: z.string(),
    title: z.string(),
  }),
});

/** A role in career.log, newest first. */
const career = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/career' }),
  schema: z.object({
    order: z.number().int(),
    /** How the timeline marks it: the next role, the current one, past ones, or one alongside. */
    kind: z.enum(['next', 'current', 'past', 'side']),
    period: z.string(),
    role: z.string(),
    company: z.string().optional(),
    anchor: z.string().optional(),
    roleLink: z.object({ text: z.string(), href: z.string() }).optional(),
    chips: z.array(z.string()).optional(),
  }),
});

/** Posts from the old craigsworks blogs, kept as they were written. */
const blog = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    /** The post's address on the old blog, which redirects here. */
    original: z.url().optional(),
    /** The Wayback Machine copy it was recovered from. */
    archived: z.url().optional(),
    summary: z.string().optional(),
  }),
});

/** Prose sections of the home page (the intro, the FAQ). */
const sections = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/sections' }),
});

const glossary = defineCollection({
  loader: file('./src/data/glossary.yaml'),
  schema: z.object({ title: z.string(), text: z.string() }),
});

const stack = defineCollection({
  loader: file('./src/data/stack.yaml'),
  schema: z.object({ order: z.number().int(), keywords: z.string(), tools: z.array(z.string()).min(1) }),
});

const focus = defineCollection({
  loader: file('./src/data/focus.yaml'),
  schema: z.object({
    label: z.string(),
    case: reference('caseStudies'),
    resp: reference('responsibilities'),
    read: z.array(z.string().regex(/^(case|resp)\/\w+$/)).min(2),
  }),
});

const recommendations = defineCollection({
  loader: file('./src/data/recommendations.yaml'),
  schema: z.object({
    order: z.number().int(),
    name: z.string(),
    role: z.string(),
    when: z.string(),
    quote: z.string(),
  }),
});

/** Open-source projects. `{stars}`, `{forks}` and `{commits}` in the text are qTip2's live counts. */
const projects = defineCollection({
  loader: file('./src/data/projects.yaml'),
  schema: z.object({
    order: z.number().int(),
    path: z.string(),
    title: z.string(),
    url: z.url().optional(),
    text: z.string(),
  }),
});

/** Merged pull requests to other projects, shown in the open-source section. */
const contributions = defineCollection({
  loader: file('./src/data/contributions.yaml'),
  schema: z.object({
    date: z.coerce.date(),
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
    pr: z.number().int(),
    title: z.string(),
  }),
});

export const collections = {
  responsibilities,
  caseStudies,
  career,
  blog,
  sections,
  glossary,
  stack,
  focus,
  recommendations,
  projects,
  contributions,
};
