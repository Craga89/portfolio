// <Phase> as first used in the site's content (examples/Phase.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Phase.mdx';
import Glossary from '../Glossary.astro';

export default { component: Mdx };

// Its terms open the shared definition popover.
const decorators = [{ component: Glossary }];

export const Phase = { args: { content: Example }, decorators };
