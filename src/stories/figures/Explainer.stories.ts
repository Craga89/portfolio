// <Explainer> as first used in the site's content (examples/Explainer.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Explainer.mdx';

export default { component: Mdx };

export const Explainer = { args: { content: Example } };
