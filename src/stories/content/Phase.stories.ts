// <Phase> as first used in the site's content (examples/Phase.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Phase.mdx';

export default { component: Mdx };

export const Phase = { args: { content: Example } };
