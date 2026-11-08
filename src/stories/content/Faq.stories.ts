// <Faq> as first used in the site's content (examples/Faq.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Faq.mdx';

export default { component: Mdx };

export const Faq = { args: { content: Example } };
