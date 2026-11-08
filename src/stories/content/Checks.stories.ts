// <Checks> as first used in the site's content (examples/Checks.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Checks.mdx';

export default { component: Mdx };

export const Checks = { args: { content: Example } };
