// <KeyRotation> as first used in the site's content (examples/KeyRotation.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/KeyRotation.mdx';

export default { component: Mdx };

export const KeyRotation = { args: { content: Example } };
