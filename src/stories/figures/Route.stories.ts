// <Route> as first used in the site's content (examples/Route.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Route.mdx';

export default { component: Mdx };

export const Route = { args: { content: Example } };
