// <Card> as first used in the site's content (examples/Card.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Card.mdx';

export default { component: Mdx };

export const Card = { args: { content: Example } };
