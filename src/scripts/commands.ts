// ask.sh commands that take the visitor somewhere themselves (the bridge is at the top of the page),
// so asking them shouldn't first scroll down to ask.sh.
export const movesPage = (q: string) => /^(bridge|lights)$/i.test(q.trim());
