// <Milestone> as first used in the site's content (examples/Milestone.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Milestone.mdx';

export default { component: Mdx };

export const Milestone = { args: { content: Example } };
