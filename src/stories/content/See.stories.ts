// <See> as first used in the site's content (examples/See.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/See.mdx';

export default { component: Mdx };

export const See = { args: { content: Example } };
