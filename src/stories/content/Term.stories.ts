// <Term> as first used in the site's content (examples/Term.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Term.mdx';
import Glossary from '../Glossary.astro';

export default { component: Mdx };

// Its terms open the shared definition popover.
const decorators = [{ component: Glossary }];

export const Term = { args: { content: Example }, decorators };
