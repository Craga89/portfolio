// <LiveResults> as first used in the site's content (examples/LiveResults.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/LiveResults.mdx';

export default { component: Mdx };

export const LiveResults = { args: { content: Example } };
