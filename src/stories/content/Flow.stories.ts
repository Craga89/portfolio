// <Flow> as first used in the site's content (examples/Flow.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Flow.mdx';

export default { component: Mdx };

export const Flow = { args: { content: Example } };
