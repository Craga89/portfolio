// <Meta> as first used in the site's content (examples/Meta.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Meta.mdx';

export default { component: Mdx };

export const Meta = { args: { content: Example } };
