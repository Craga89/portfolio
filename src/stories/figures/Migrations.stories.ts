// <Migrations> as first used in the site's content (examples/Migrations.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Migrations.mdx';

export default { component: Mdx };

export const Migrations = { args: { content: Example } };
