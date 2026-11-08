// <AiPlatform> as first used in the site's content (examples/AiPlatform.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/AiPlatform.mdx';

export default { component: Mdx };

export const AiPlatform = { args: { content: Example } };
