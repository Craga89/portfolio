// <Era> as first used in the site's content (examples/Era.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Era.mdx';

export default { component: Mdx };

export const Era = { args: { content: Example } };
