// The agent tools shared by the page (WebMCP) and the worker (MCP): search, files and arguments.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bestAnswer, callTool, checkArgs, describeTools, files, hasTool, NOT_FOUND, prepareIndex, rank, slug, toks, ToolError } from '../../../shared/agent-tools.js';

/** @param {string} id @param {string} title @param {string} text @param {string} [kind] */
const passage = (id, title, text, kind = 'section') => ({ id, title, text, href: '#' + id, kind, key: id });
const INDEX = prepareIndex({
  passages: [
    passage('intro', 'About', 'Head of Engineering in Newcastle. Leads teams of engineers.'),
    passage('case-cost', 'cost.md: Cutting the AWS bill', 'Cut the monthly AWS bill by a third. Rightsized databases.', 'case'),
    passage('resp-hire', 'hiring.md: Hiring', 'Hired twenty engineers with structured interviews.', 'resp'),
    passage('blog-x', 'durandal-and-webpack.md: Durandal and webpack', 'A post about module formats.', 'blog'),
  ],
});

describe('search', () => {
  it('tokenises without stop words or punctuation', () => {
    assert.deepEqual(toks('What does Craig know about AWS, C# and Node.js?'), ['know', 'aws', 'c#', 'node.js']);
    assert.deepEqual(toks(null), ['null']);
  });

  it('ranks title hits first and understands everyday words', () => {
    assert.equal(rank(INDEX, 'AWS cost')[0].p.id, 'case-cost');
    // "money" means budget and cost.
    assert.equal(rank(INDEX, 'money')[0].p.id, 'case-cost');
    // "hire" matches "hiring" and "hired".
    assert.equal(rank(INDEX, 'Can he hire?')[0].p.id, 'resp-hire');
    assert.deepEqual(rank(INDEX, 'zzzz'), []);
  });

  it('answers from the best passage, or says nothing was found', () => {
    const a = bestAnswer(INDEX, 'AWS bill');
    assert.match(a.answer, /^Cut the monthly AWS bill/);
    assert.equal(a.sources[0].id, 'case-cost');
    assert.deepEqual(bestAnswer(INDEX, 'zzzz'), { answer: NOT_FOUND, sources: [] });
  });
});

describe('files', () => {
  it('names each file page as the build does', () => {
    assert.equal(slug('ai/platform.md'), 'ai-platform');
    const list = files(INDEX, (p) => 'https://example.dev/' + p);
    assert.deepEqual(
      list.map((f) => [f.file, f.section, f.url]),
      [
        ['cost.md', 'case-studies', 'https://example.dev/case-studies/cost/'],
        ['hiring.md', 'responsibilities', 'https://example.dev/responsibilities/hiring/'],
        ['durandal-and-webpack.md', 'blog', 'https://example.dev/blog/durandal-and-webpack/'],
      ],
    );
  });
});

describe('arguments', () => {
  /** @type {import('../../../shared/agent-tools.js').Schema} */
  const schema = {
    type: 'object',
    properties: { q: { type: 'string', maxLength: 5 }, n: { type: 'integer', minimum: 1, maximum: 3 }, on: { type: 'boolean' }, kind: { enum: ['a', 'b'] } },
    required: ['q'],
  };

  it('accepts good arguments', () => {
    assert.equal(checkArgs(schema, { q: 'hi', n: 2, on: true, kind: 'a' }), '');
  });

  it('says what is wrong with bad ones', () => {
    assert.equal(checkArgs(schema, []), 'Arguments must be an object.');
    assert.equal(checkArgs(schema, {}), 'Missing "q".');
    assert.equal(checkArgs(schema, { q: 4 }), '"q" must be a string.');
    assert.equal(checkArgs(schema, { q: 'toolong' }), '"q" is too long (at most 5 characters).');
    assert.equal(checkArgs(schema, { q: 'x', n: 1.5 }), '"n" must be a whole number.');
    assert.equal(checkArgs(schema, { q: 'x', n: 0 }), '"n" must be at least 1.');
    assert.equal(checkArgs(schema, { q: 'x', n: 9 }), '"n" must be at most 3.');
    assert.equal(checkArgs(schema, { q: 'x', on: 'yes' }), '"on" must be true or false.');
    assert.equal(checkArgs(schema, { q: 'x', kind: 'c' }), '"kind" must be one of: a, b.');
  });
});

describe('tools', () => {
  /** @type {import('../../../shared/agent-tools.js').Source} */
  const src = /** @type {any} */ ({
    url: (/** @type {string} */ p) => 'https://example.dev/' + p,
    index: async () => INDEX,
    cv: async () => {
      throw new ToolError('The CV is unavailable.');
    },
  });

  it('offers page-only tools on the page and not over MCP', () => {
    assert.ok(hasTool('show_section', 'page'));
    assert.ok(!hasTool('show_section', 'mcp'));
    const page = describeTools('page', src).map((t) => t.name);
    const mcp = describeTools('mcp', src).map((t) => t.name);
    assert.ok(mcp.every((n) => page.includes(n)));
    assert.ok(describeTools('mcp', src).every((t) => t.annotations.readOnlyHint && !t.annotations.destructiveHint));
  });

  it('returns failures as results the agent can act on, never throws', async () => {
    assert.deepEqual(await callTool('nope', {}, src, 'mcp'), { content: [{ type: 'text', text: 'No tool called "nope".' }], isError: true });
    assert.equal((await callTool('search_site', { query: 42 }, src, 'mcp')).isError, true);
    const failed = await callTool('get_profile', {}, src, 'mcp');
    assert.deepEqual(failed, { content: [{ type: 'text', text: 'The CV is unavailable.' }], isError: true });
  });

  it('adds structured content over MCP', async () => {
    const r = await callTool('search_site', { query: 'AWS' }, src, 'mcp');
    assert.equal(r.isError, undefined);
    assert.deepEqual(r.structuredContent, JSON.parse(r.content[0].text));
  });
});
