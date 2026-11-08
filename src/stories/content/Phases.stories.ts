// <Phases> as first used in the site's content (examples/Phases.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Phases.mdx';

export default { component: Mdx };

export const Phases = { args: { content: Example } };
