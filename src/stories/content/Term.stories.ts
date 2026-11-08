// <Term> as first used in the site's content (examples/Term.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Term.mdx';

export default { component: Mdx };

export const Term = { args: { content: Example } };
