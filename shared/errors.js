// What to log or show for a caught value, which may not be an Error.

/** @param {unknown} e */
export const errorMessage = (e) => (e instanceof Error ? e.message : String(e));
