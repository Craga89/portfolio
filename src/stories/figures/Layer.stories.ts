// <Layer> as first used in the site's content (examples/Layer.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Layer.mdx';

export default { component: Mdx };

export const Layer = { args: { content: Example } };
