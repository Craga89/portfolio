// <Migration> as first used in the site's content (examples/Migration.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Migration.mdx';

export default { component: Mdx };

export const Migration = { args: { content: Example } };
