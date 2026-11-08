// <Stat> as first used in the site's content (examples/Stat.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Stat.mdx';

export default { component: Mdx };

export const Stat = { args: { content: Example } };
