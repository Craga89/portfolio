// <Phases> as first used in the site's content (examples/Phases.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Phases.mdx';
import Glossary from '../Glossary.astro';

export default { component: Mdx };

// Its terms open the shared definition popover.
const decorators = [{ component: Glossary }];

export const Phases = { args: { content: Example }, decorators };
