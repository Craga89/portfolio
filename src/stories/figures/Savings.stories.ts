// <Savings> as first used in the site's content (examples/Savings.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Savings.mdx';

export default { component: Mdx };

export const Savings = { args: { content: Example } };
