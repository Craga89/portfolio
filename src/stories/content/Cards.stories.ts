// <Cards> as first used in the site's content (examples/Cards.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Cards.mdx';

export default { component: Mdx };

export const Cards = { args: { content: Example } };
