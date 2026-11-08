// <Job> as first used in the site's content (examples/Job.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Job.mdx';

export default { component: Mdx };

export const Job = { args: { content: Example } };
