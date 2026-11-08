// <InPractice> as first used in the site's content (examples/InPractice.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/InPractice.mdx';

export default { component: Mdx };

export const InPractice = { args: { content: Example } };
