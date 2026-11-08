// <Buckets> as first used in the site's content (examples/Buckets.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Buckets.mdx';

export default { component: Mdx };

export const Buckets = { args: { content: Example } };
