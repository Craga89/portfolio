// <Stage> as first used in the site's content (examples/Stage.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Stage.mdx';

export default { component: Mdx };

export const Stage = { args: { content: Example } };
