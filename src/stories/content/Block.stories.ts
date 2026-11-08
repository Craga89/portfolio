// <Block> isn't used in the content files on its own, only inside other components (Cards, Tools).
import Example from '../examples/Block.astro';

export default { component: Example };

export const Plain = {};
export const Accent = { args: { tone: 'acc' } };
