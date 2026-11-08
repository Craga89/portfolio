// <Row> as first used in the site's content (examples/Row.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Row.mdx';

export default { component: Mdx };

export const Row = { args: { content: Example } };
