// <Tagline> as first used in the site's content (examples/Tagline.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Tagline.mdx';

export default { component: Mdx };

export const Tagline = { args: { content: Example } };
