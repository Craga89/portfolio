// <Pipeline> as first used in the site's content (examples/Pipeline.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Pipeline.mdx';

export default { component: Mdx };

export const Pipeline = { args: { content: Example } };
