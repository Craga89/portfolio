// <Evolution> as first used in the site's content (examples/Evolution.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Evolution.mdx';

export default { component: Mdx };

export const Evolution = { args: { content: Example } };
