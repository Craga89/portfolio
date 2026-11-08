// <FlowStep> as first used in the site's content (examples/FlowStep.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/FlowStep.mdx';

export default { component: Mdx };

export const FlowStep = { args: { content: Example } };
