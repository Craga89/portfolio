// <Step> as first used in the site's content (examples/Step.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Step.mdx';

export default { component: Mdx };

export const Step = { args: { content: Example } };
