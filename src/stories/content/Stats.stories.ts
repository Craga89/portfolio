// <Stats> as first used in the site's content (examples/Stats.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Stats.mdx';

export default { component: Mdx };

export const Stats = { args: { content: Example } };
