// A dated list (Ledger) of entries (LedgerItem): the newest blog posts.
import Example from '../examples/Ledger.astro';

export default { component: Example };

export const FivePosts = {};
export const OnePost = { args: { count: 1 } };
