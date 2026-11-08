// <Compare> as first used in the site's content (examples/Compare.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Compare.mdx';

export default { component: Mdx };

export const Compare = { args: { content: Example } };
