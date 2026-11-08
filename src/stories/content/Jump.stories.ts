// <Jump> as first used in the site's content (examples/Jump.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Jump.mdx';

export default { component: Mdx };

export const Jump = { args: { content: Example } };
