// <Tags> as first used in the site's content (examples/Tags.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Tags.mdx';

export default { component: Mdx };

export const Tags = { args: { content: Example } };
