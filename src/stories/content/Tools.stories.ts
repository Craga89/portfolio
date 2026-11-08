// <Tools> as first used in the site's content (examples/Tools.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Tools.mdx';

export default { component: Mdx };

export const Tools = { args: { content: Example } };
