// <Explainers> as first used in the site's content (examples/Explainers.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Explainers.mdx';

export default { component: Mdx };

export const Explainers = { args: { content: Example } };
