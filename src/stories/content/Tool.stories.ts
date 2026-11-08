// <Tool> as first used in the site's content (examples/Tool.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Tool.mdx';

export default { component: Mdx };

export const Tool = { args: { content: Example } };
