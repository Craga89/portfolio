// <ArchStack> as first used in the site's content (examples/ArchStack.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/ArchStack.mdx';

export default { component: Mdx };

export const ArchStack = { args: { content: Example } };
