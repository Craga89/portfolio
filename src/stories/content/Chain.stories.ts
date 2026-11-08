// <Chain> as first used in the site's content (examples/Chain.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Chain.mdx';

export default { component: Mdx };

export const Chain = { args: { content: Example } };
