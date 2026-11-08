// <McpStatus> as first used in the site's content (examples/McpStatus.mdx, from tools/stories.mjs).
import Mdx from '../Mdx.astro';
import Example from '../examples/McpStatus.mdx';

export default { component: Mdx };

export const McpStatus = { args: { content: Example } };
