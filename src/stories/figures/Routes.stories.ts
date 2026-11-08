// <Routes> as first used in the site's content (examples/Routes.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Routes.mdx';

export default { component: Mdx };

export const Routes = { args: { content: Example } };
