// <BuildBars> as first used in the site's content (examples/BuildBars.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/BuildBars.mdx';

export default { component: Mdx };

export const BuildBars = { args: { content: Example } };
