// <Tiles> as first used in the site's content (examples/Tiles.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Tiles.mdx';

export default { component: Mdx };

export const Tiles = { args: { content: Example } };
