// Tools for AI agents, shared by the page (WebMCP, in the visitor's browser) and the ask.sh worker
// (MCP, for any MCP client). One definition per tool; each surface passes a small "source" that
// says where the data comes from:
//
//   cv()        the CV as JSON Resume
//   index()     the site's passages, prepared with prepareIndex()
//   live()      the latest live.json (CI results, open-source counts), or {}
//   oss()       optional: the open-source counts from the last build, for when live.json is unreachable
//   projects()  open-source projects linked from the site: [{ name, url }]
//   url(path)   an absolute URL on the site for a path or #section
//   ask(q, signal)  { answer, sources: [passage ids] } from the ask.sh model; throws if unavailable
//   build()     { sha, at } of the deployed site, if known
//   page only:  sections() for show_section, show(file) and scroll(section) to move the page
//
// Also the site's keyword search (tokens, synonyms, ranking), used by ask.sh on the page, by the
// worker to pick context for the model, and by the search_site tool.
// The page build bundles this file as window.CragaAgent; the worker imports it.

/**
 * A passage of the site's own words, as the build extracts them.
 * @typedef {{ id: string, title: string, text: string, href: string, kind: string, key: string }} Passage
 * @typedef {Passage & { _t: string[], _b: string[] }} IndexedPassage
 * @typedef {{ generated?: string, passages: IndexedPassage[], byId: Record<string, IndexedPassage>, idf: (w: string) => number, toks: typeof toks }} Index
 * @typedef {{ timeline?: { y: number, q: number, n: number, repos: string[] }[], prs?: number, repos?: number, since?: number, at?: string, qtip?: { stars: number, forks: number, commits: number } }} OssCounts
 * @typedef {{ oss?: OssCounts, build?: { sha?: string, at?: string }, lighthouse?: { mobile?: unknown, desktop?: unknown, at?: string }, a11y?: { pass?: boolean, axeRuns?: number, violations?: number, at?: string }, evals?: { passed?: number, total?: number, at?: string } }} Live
 * @typedef {{ answer: string, sources?: string[] }} AskResult
 * @typedef {'page' | 'mcp'} Surface
 *
 * Where a surface's data comes from (see the top of the file).
 * @typedef {object} Source
 * @property {() => Promise<any>} cv the CV as JSON Resume
 * @property {() => Promise<Index>} index
 * @property {() => Promise<Live>} live
 * @property {() => Promise<OssCounts | null>} [oss]
 * @property {() => Promise<{ name: string, url: string }[]>} projects
 * @property {(path: string) => string} url
 * @property {(q: string, signal?: AbortSignal) => Promise<AskResult>} ask
 * @property {() => ({ sha?: string, at?: string } | null)} [build]
 * @property {() => string[]} [sections]
 * @property {(f: FileEntry) => void} [show]
 * @property {(section: string) => void} [scroll]
 *
 * @typedef {{ file: string, section: string, title: string, key: string, url: string, text: string }} FileEntry
 *
 * A JSON Schema for a tool's arguments, as far as checkArgs() understands it.
 * @typedef {{ type?: string, enum?: string[], maxLength?: number, minimum?: number, maximum?: number, description?: string, surface?: Surface }} Property
 * @typedef {{ type: 'object', properties: Record<string, Property>, required?: string[] }} Schema
 *
 * @typedef {object} Tool
 * @property {string} name
 * @property {string} title
 * @property {string} description
 * @property {string} [pageDescription] added to the description on the page
 * @property {Surface[]} [surfaces] where it's offered (default: everywhere)
 * @property {Schema | ((src: Source) => Schema)} inputSchema
 * @property {boolean} readOnly
 * @property {(args: any, src: Source, surface: Surface, signal?: AbortSignal) => Promise<unknown>} run
 */

/** A failure the agent can act on: its message is shown as the tool result. */
export class ToolError extends Error {}

// ---------- search ----------

const STOP = new Set(
  'a an and are as at be been but by can did do does for from had has have he her his how i in is it its me my of on or our she so that the their them they this to was we were what when where which who why will with you your about any ever there craig craigs'.split(
    ' ',
  ),
);

/** Lowercase search words, without stop words. @param {unknown} s @returns {string[]} */
export const toks = (s) =>
  (
    String(s)
      .toLowerCase()
      .match(/[a-z0-9+#.]+/g) || []
  )
    .map((w) => w.replace(/\.+$/, ''))
    .filter((w) => w.length > 1 && !STOP.has(w));

// Everyday words for things the site names differently.
/** @type {Record<string, string>} */
export const ALT = {
  study: 'education university degree meng',
  studied: 'education university degree meng',
  degree: 'education university meng',
  university: 'education',
  qualification: 'education degree',
  qualifications: 'education degree',
  school: 'education university',
  salary: 'roles open',
  pay: 'roles open',
  location: 'newcastle remote hybrid',
  based: 'newcastle remote hybrid',
  live: 'newcastle remote hybrid',
  remote: 'hybrid newcastle',
  team: 'engineers lead',
  manage: 'lead leadership engineers',
  managed: 'lead leadership engineers',
  hire: 'hiring hired interview',
  hiring: 'hired interview',
  money: 'budget cost',
  budget: 'cost',
  cost: 'budget',
  security: 'iso27001 soc compliance',
  compliance: 'iso27001 audit',
  oncall: 'incidents on-call',
  'on-call': 'incidents',
  outage: 'incidents',
  open: 'roles',
  ai: 'ai-first llm',
};

/**
 * Tokenise every passage once and work out how rare each word is.
 * @param {{ generated?: string, passages?: Passage[] }} data the ask-index.json / knowledge.json contents
 * @returns {Index}
 */
export function prepareIndex(data) {
  const passages = (data.passages || []).map((p) => Object.assign({}, p, { _t: toks(p.title), _b: toks(p.text) }));
  /** @type {Record<string, number>} */
  const df = {};
  passages.forEach((p) =>
    new Set(p._t.concat(p._b)).forEach((w) => {
      df[w] = (df[w] || 0) + 1;
    }),
  );
  /** @type {Record<string, IndexedPassage>} */
  const byId = {};
  passages.forEach((p) => {
    byId[p.id] = p;
  });
  return {
    generated: data.generated,
    passages,
    byId,
    idf: (w) => Math.log(1 + passages.length / (df[w] || 0.5)),
    toks,
  };
}

/**
 * Passages that match the query, best first: title hits count triple, long passages are damped.
 * @param {Index} index
 * @param {string} q
 */
export function rank(index, q) {
  const base = toks(q);
  const terms = base.concat(...base.map((w) => (ALT[w] ? ALT[w].split(' ').filter((x) => !base.includes(x)) : [])));
  return index.passages
    .map((p) => {
      let s = 0;
      for (const w of terms) {
        const stem = w.length > 4 ? w.slice(0, -1) : w;
        /** @param {string[]} arr */
        const hit = (arr) => arr.reduce((n, x) => n + (x === w || (stem.length > 3 && x.startsWith(stem)) ? 1 : 0), 0);
        s += (3 * hit(p._t) + Math.min(hit(p._b), 4)) * index.idf(w);
      }
      return { p, s: s / Math.sqrt(10 + p._b.length / 20) };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
}

export const NOT_FOUND =
  "I couldn't find anything about that on the site. Email craga89@gmail.com and Craig will answer directly.";

/**
 * The closest passage, trimmed to a few sentences: ask.sh's answer when the model isn't available.
 * @param {Index} index
 * @param {string} q
 */
export function bestAnswer(index, q) {
  const scored = rank(index, q);
  if (!scored.length) return { answer: NOT_FOUND, sources: [] };
  const sentences = scored[0].p.text.match(/[^.!?]+[.!?]+/g) || [scored[0].p.text];
  let answer = '';
  for (const s of sentences) {
    if ((answer + s).length > 420 && answer) break;
    answer += s;
  }
  return { answer: answer.trim(), sources: scored.slice(0, 3).map((x) => x.p) };
}

// ---------- files ----------

/** The site section each kind of file passage lives in. @type {Record<string, string>} */
const SECTION = { case: 'case-studies', resp: 'responsibilities', blog: 'blog' };
/** The URL path of a file's own page, as the build names it: ai/platform.md → ai-platform. @param {string} file */
export const slug = (file) => String(file).replace(/\.md$/, '').replace(/\//g, '-');

/**
 * Every file (case study, responsibility, blog post), from its passage.
 * @param {Index} index
 * @param {(path: string) => string} url
 * @returns {FileEntry[]}
 */
export function files(index, url) {
  return index.passages
    .filter((p) => SECTION[p.kind])
    .map((p) => {
      const parts = String(p.title).split(':');
      const file = parts[0].trim();
      const section = SECTION[p.kind];
      return {
        file,
        section,
        title: parts.slice(1).join(':').trim(),
        key: p.key,
        url: url(section + '/' + slug(file) + '/'),
        text: p.text,
      };
    });
}

// Where a passage lives on the site: a file's own page, or a section of the home page.
/** @param {Passage} p @param {(path: string) => string} url */
const passageUrl = (p, url) =>
  SECTION[p.kind] ? url(SECTION[p.kind] + '/' + slug(String(p.title).split(':')[0].trim()) + '/') : url(p.href || '/');

// Open-source projects linked from the site's open-source section, in page order.
// Runs in a browser: on the page itself, and in the build to write the worker's copy.
/** @param {{ querySelectorAll(selectors: string): Iterable<any> }} doc a Document */
export function linkedProjects(doc) {
  /** @type {{ name: string, url: string }[]} */
  const out = [];
  for (const a of /** @type {Iterable<{ href: string, textContent: string | null }>} */ (
    doc.querySelectorAll('#oss a[href^="https://github.com/"]')
  )) {
    const url = a.href.replace(/\/$/, '');
    if (!out.some((p) => p.url === url)) out.push({ name: (a.textContent || '').trim(), url });
  }
  return out;
}

// ---------- tools ----------

/** @type {Schema} */
const NONE = { type: 'object', properties: {} };
/** @param {string} t @param {number} n */
const clip = (t, n) => (t.length > n ? t.slice(0, n) + '…' : t);

/** @type {Tool[]} */
export const TOOLS = [
  {
    name: 'get_profile',
    title: 'Profile and contact',
    description:
      "Craig Michael Thompson's profile: headline, summary, location, what roles he's open to, how to contact him, links to his CV (web, PDF, JSON Resume), GitHub and LinkedIn, and his skills.",
    inputSchema: NONE,
    readOnly: true,
    async run(a, src) {
      const c = await src.cv();
      const b = c.basics || {};
      return {
        name: b.name,
        headline: b.label,
        summary: b.summary,
        location: b.location
          ? [b.location.city, b.location.region, b.location.countryCode].filter(Boolean).join(', ')
          : '',
        email: b.email,
        links: {
          portfolio: src.url('/'),
          cv: src.url('cv/'),
          cv_pdf: src.url('cv.pdf'),
          cv_json: src.url('cv.json'),
          contact_card: src.url('craig-thompson.vcf'),
          profiles: (b.profiles || []).map((/** @type {any} */ p) => ({ network: p.network, url: p.url })),
        },
        skills: (c.skills || []).map((/** @type {any} */ s) => ({ area: s.name, keywords: s.keywords })),
      };
    },
  },
  {
    name: 'get_career',
    title: 'Career history',
    description:
      'Every role Craig has held, newest first, with dates, a summary and highlights, plus his education. The same content as his CV.',
    inputSchema: NONE,
    readOnly: true,
    async run(a, src) {
      const c = await src.cv();
      return {
        work: (c.work || []).map((/** @type {any} */ w) => ({
          company: w.name,
          role: w.position,
          location: w.location,
          start: w.startDate,
          end: w.endDate || 'present',
          summary: w.summary,
          highlights: w.highlights || [],
        })),
        education: (c.education || []).map((/** @type {any} */ e) => ({
          institution: e.institution,
          qualification: [e.studyType, e.area].filter(Boolean).join(', '),
          start: e.startDate,
          end: e.endDate,
        })),
      };
    },
  },
  {
    name: 'list_files',
    title: 'List case studies, responsibilities and blog posts',
    description:
      "List the portfolio's files: case studies (projects Craig has led, with outcomes), responsibilities (what he has owned as Head of Engineering) and blog posts (technical posts from his old blog, 2010-2015). Returns each file name, title and page URL. Read one with read_file.",
    inputSchema: {
      type: 'object',
      properties: {
        section: {
          type: 'string',
          enum: ['all', 'case-studies', 'responsibilities', 'blog'],
          description: 'Which set to list. Defaults to all.',
        },
      },
    },
    readOnly: true,
    async run(a, src) {
      const fs = files(await src.index(), src.url);
      return {
        files: fs
          .filter((f) => !a.section || a.section === 'all' || f.section === a.section)
          .map((f) => ({ file: f.file, section: f.section, title: f.title, url: f.url })),
      };
    },
  },
  {
    name: 'read_file',
    title: 'Read a case study, responsibility or blog post',
    description:
      'The text of one case study, responsibility or blog post, by file name from list_files (for example monorepo.md or hiring.md). Blog posts come back as a summary with a link to the full post.',
    pageDescription: ' Set show to true to also open it on the page for the person you are helping.',
    inputSchema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          maxLength: 100,
          description: 'File name, for example "monorepo.md", "ai/platform.md" or "budget.md".',
        },
        show: {
          type: 'boolean',
          surface: 'page',
          description: 'Also open the file on the page and scroll to it. Defaults to false.',
        },
      },
      required: ['file'],
    },
    readOnly: true,
    async run(a, src, surface) {
      const fs = files(await src.index(), src.url);
      const want = String(a.file)
        .trim()
        .toLowerCase()
        .replace(/^\.?\//, '')
        .replace(/^(case-studies|responsibilities|blog)\//, '')
        .replace(/\/$/, '');
      const f = fs.find(
        (x) =>
          x.file.toLowerCase() === want ||
          x.file.toLowerCase().replace(/\.md$/, '') === want ||
          slug(x.file) === want ||
          x.key === want,
      );
      if (!f) throw new ToolError('No file called "' + a.file + '". Files: ' + fs.map((x) => x.file).join(', ') + '.');
      if (a.show && surface === 'page' && src.show) src.show(f);
      return { file: f.file, section: f.section, title: f.title, url: f.url, text: f.text };
    },
  },
  {
    name: 'search_site',
    title: 'Search the portfolio',
    description:
      "Keyword search across everything on the site (profile, career, responsibilities, case studies, stack, FAQ). Returns the best-matching passages in Craig's own words. Use ask for a written answer instead.",
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          maxLength: 300,
          description: 'What to look for, for example "AWS cost" or "accessibility".',
        },
        limit: { type: 'integer', minimum: 1, maximum: 10, description: 'How many passages to return. Defaults to 5.' },
      },
      required: ['query'],
    },
    readOnly: true,
    async run(a, src) {
      const q = a.query.trim();
      if (!q) throw new ToolError('Give a query to search for.');
      return {
        query: q,
        results: rank(await src.index(), q)
          .slice(0, a.limit || 5)
          .map(({ p }) => ({ title: p.title, text: clip(p.text, 900), url: passageUrl(p, src.url) })),
      };
    },
  },
  {
    name: 'ask',
    title: 'Ask a question (ask.sh)',
    description:
      "Ask a question about Craig's experience and get a short answer written only from this site's content, the same as the ask.sh box on the site. Rate-limited, so ask one question at a time; for exact wording use read_file or search_site.",
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          maxLength: 300,
          description: 'The question, for example "Has Craig led an ISO 27001 audit?"',
        },
      },
      required: ['question'],
    },
    readOnly: true,
    async run(a, src, surface, signal) {
      const q = a.question.replace(/\s+/g, ' ').trim();
      if (!q) throw new ToolError('Give a question to ask.');
      const index = await src.index();
      /** @param {string} id */
      const title = (id) => (index.byId[id] ? index.byId[id].title : id);
      try {
        const d = await src.ask(q, signal);
        if (!d || !d.answer) throw new Error('empty answer');
        return { question: q, answer: d.answer, via: 'ai', sources: (d.sources || []).map(title) };
      } catch (e) {
        if (e instanceof ToolError) throw e;
        const r = bestAnswer(index, q);
        return {
          question: q,
          answer: r.answer,
          via: 'search',
          note: "The AI answer service didn't respond, so this is the closest passage from the site.",
          sources: r.sources.map((p) => p.title),
        };
      }
    },
  },
  {
    name: 'get_open_source',
    title: 'Open-source contributions',
    description:
      "Craig's open-source work: merged pull requests to other people's projects (with a per-quarter timeline and the repositories), and qTip2, the jQuery tooltip library he wrote and maintains. Counts come from the GitHub API, updated weekly.",
    inputSchema: NONE,
    readOnly: true,
    async run(a, src) {
      // live.json is newest; the snapshot from the last build covers it being unreachable.
      const o = (await src.live()).oss || (src.oss && (await src.oss())) || {};
      const tl = o.timeline || [];
      return {
        merged_pull_requests: o.prs != null ? o.prs : tl.reduce((n, t) => n + t.n, 0),
        repositories: o.repos,
        since: o.since,
        counted_at: o.at,
        qtip2: Object.assign(
          { url: 'https://github.com/qTip2/qTip2' },
          o.qtip ? { stars: o.qtip.stars, forks: o.qtip.forks, commits: o.qtip.commits } : {},
        ),
        by_quarter: tl.map((t) => ({ year: t.y, quarter: t.q, merged: t.n, repositories: t.repos })),
        linked_projects: await src.projects(),
        github: 'https://github.com/Craga89',
      };
    },
  },
  {
    name: 'get_site_report',
    title: 'How this site is built and tested',
    description:
      "This site's latest automated results: Lighthouse scores (mobile and desktop), the WCAG 2.2 AA accessibility suite, and the ask.sh answer tests, with the deployed commit and the public source repository.",
    inputSchema: NONE,
    readOnly: true,
    async run(a, src) {
      const l = await src.live();
      const b = l.build || (src.build && src.build()) || {};
      return {
        source: 'https://github.com/Craga89/portfolio',
        deployed: { commit: b.sha || null, at: b.at || null },
        lighthouse: l.lighthouse
          ? { mobile: l.lighthouse.mobile, desktop: l.lighthouse.desktop, at: l.lighthouse.at }
          : null,
        accessibility: l.a11y
          ? {
              standard: 'WCAG 2.2 AA',
              pass: l.a11y.pass,
              axe_runs: l.a11y.axeRuns,
              violations: l.a11y.violations,
              at: l.a11y.at,
            }
          : null,
        ask_tests: l.evals ? { passed: l.evals.passed, total: l.evals.total, at: l.evals.at } : null,
        note: l.lighthouse || l.a11y || l.evals ? '' : "The latest results aren't available right now.",
      };
    },
  },
  {
    name: 'show_section',
    title: 'Show a section of the page',
    description:
      'Scroll the page to one of its sections and highlight it, to point the person you are helping at something.',
    surfaces: ['page'],
    inputSchema: (src) => ({
      type: 'object',
      properties: { section: { type: 'string', enum: src.sections ? src.sections() : [], description: 'Section id.' } },
      required: ['section'],
    }),
    readOnly: false,
    async run(a, src) {
      if (src.scroll) src.scroll(a.section);
      return { shown: a.section, url: src.url('#' + a.section) };
    },
  },
];

/** @param {Tool} t @param {Surface} surface */
const onSurface = (t, surface) => !t.surfaces || t.surfaces.includes(surface);

/**
 * The schema a surface sees: page-only arguments are left out elsewhere.
 * @param {Tool} t
 * @param {Surface} surface
 * @param {Source} src
 * @returns {Schema}
 */
function schemaFor(t, surface, src) {
  const s = typeof t.inputSchema === 'function' ? t.inputSchema(src) : t.inputSchema;
  /** @type {Record<string, Property>} */
  const properties = {};
  Object.keys(s.properties || {}).forEach((k) => {
    const p = s.properties[k];
    if (p.surface && p.surface !== surface) return;
    const copy = Object.assign({}, p);
    delete copy.surface;
    properties[k] = copy;
  });
  /** @type {Schema} */
  const out = { type: 'object', properties };
  if (s.required) out.required = s.required.filter((k) => properties[k]);
  return out;
}

/**
 * Tool definitions for a surface, in a fixed order.
 * @param {Surface} surface
 * @param {Source} src
 */
export function describeTools(surface, src) {
  return TOOLS.filter((t) => onSurface(t, surface)).map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description + (surface === 'page' && t.pageDescription ? t.pageDescription : ''),
    inputSchema: schemaFor(t, surface, src),
    annotations: { title: t.title, readOnlyHint: t.readOnly, destructiveHint: false, openWorldHint: false },
  }));
}

/**
 * Check arguments against the schema; returns an error message or ''.
 * @param {Schema} schema
 * @param {unknown} input
 */
export function checkArgs(schema, input) {
  const args = /** @type {Record<string, any>} */ (input == null ? {} : input);
  if (typeof args !== 'object' || Array.isArray(args)) return 'Arguments must be an object.';
  for (const k of schema.required || []) if (args[k] == null || args[k] === '') return 'Missing "' + k + '".';
  for (const k of Object.keys(args)) {
    const p = schema.properties[k];
    const v = args[k];
    if (!p || v == null) continue;
    if (p.type === 'string' && typeof v !== 'string') return '"' + k + '" must be a string.';
    if (p.type === 'boolean' && typeof v !== 'boolean') return '"' + k + '" must be true or false.';
    if (p.type === 'integer' && !Number.isInteger(v)) return '"' + k + '" must be a whole number.';
    if (p.enum && !p.enum.includes(v)) return '"' + k + '" must be one of: ' + p.enum.join(', ') + '.';
    if (p.maxLength && v.length > p.maxLength)
      return '"' + k + '" is too long (at most ' + p.maxLength + ' characters).';
    if (p.minimum != null && v < p.minimum) return '"' + k + '" must be at least ' + p.minimum + '.';
    if (p.maximum != null && v > p.maximum) return '"' + k + '" must be at most ' + p.maximum + '.';
  }
  return '';
}

/** @param {string} name @param {Surface} surface */
export const hasTool = (name, surface) => TOOLS.some((t) => t.name === name && onSurface(t, surface));

/**
 * An MCP CallToolResult.
 * @typedef {{ content: { type: 'text', text: string }[], isError?: boolean, structuredContent?: unknown }} ToolResult
 */

/**
 * Run a tool. Bad arguments and failures come back as isError results (so the agent can
 * correct itself), never as thrown errors.
 * @param {string} name
 * @param {unknown} args
 * @param {Source} src
 * @param {Surface} surface
 * @param {AbortSignal} [signal]
 * @returns {Promise<ToolResult>}
 */
export async function callTool(name, args, src, surface, signal) {
  const t = TOOLS.find((x) => x.name === name && onSurface(x, surface));
  /** @param {string} msg @returns {ToolResult} */
  const fail = (msg) => ({ content: [{ type: 'text', text: msg }], isError: true });
  if (!t) return fail('No tool called "' + name + '".');
  const bad = checkArgs(schemaFor(t, surface, src), args);
  if (bad) return fail(bad);
  try {
    const data = await t.run(Object.assign({}, args || {}), src, surface, signal);
    /** @type {ToolResult} */
    const out = { content: [{ type: 'text', text: JSON.stringify(data) }] };
    if (surface === 'mcp') out.structuredContent = data;
    return out;
  } catch (e) {
    if (e instanceof ToolError) return fail(e.message);
    return fail(
      'Something went wrong (' +
        (e instanceof Error ? e.message : String(e)) +
        '). The same information is on the site and in ' +
        src.url('llms.txt') +
        '.',
    );
  }
}

export const SERVER_INSTRUCTIONS =
  'Read-only tools about Craig Michael Thompson, Head of Engineering and full-stack engineer: his profile and contact details, career, case studies and responsibilities, open-source work, old blog posts, and how his portfolio site is tested. Every answer comes from his portfolio site. Start with get_profile or list_files; use search_site or ask for specific questions.';
