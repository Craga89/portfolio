// <Gate> as first used in the site's content (examples/Gate.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/Gate.mdx';

export default { component: Mdx };

export const Gate = { args: { content: Example } };
