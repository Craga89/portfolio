// <Side> as first used in the site's content (examples/Side.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Side.mdx';

export default { component: Mdx };

export const Side = { args: { content: Example } };
