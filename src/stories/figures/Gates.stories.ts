// <Gates> as first used in the site's content (examples/Gates.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Gates.mdx';

export default { component: Mdx };

export const Gates = { args: { content: Example } };
