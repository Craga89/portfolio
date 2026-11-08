// <Method> as first used in the site's content (examples/Method.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Method.mdx';

export default { component: Mdx };

export const Method = { args: { content: Example } };
