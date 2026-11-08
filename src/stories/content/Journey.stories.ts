// <Journey> as first used in the site's content (examples/Journey.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Journey.mdx';

export default { component: Mdx };

export const Journey = { args: { content: Example } };
