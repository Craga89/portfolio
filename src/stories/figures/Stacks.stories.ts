// <Stacks> as first used in the site's content (examples/Stacks.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Stacks.mdx';

export default { component: Mdx };

export const Stacks = { args: { content: Example } };
