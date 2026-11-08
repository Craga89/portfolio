// <Versus> as first used in the site's content (examples/Versus.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Versus.mdx';

export default { component: Mdx };

export const Versus = { args: { content: Example } };
