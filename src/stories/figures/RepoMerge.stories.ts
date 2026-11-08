// <RepoMerge> as first used in the site's content (examples/RepoMerge.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/RepoMerge.mdx';

export default { component: Mdx };

export const RepoMerge = { args: { content: Example } };
