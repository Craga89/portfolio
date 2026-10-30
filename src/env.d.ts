/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly ALLOW_INDEXING?: string;
  /** Set on branch previews: the branch being previewed. */
  readonly PREVIEW_BRANCH?: string;
}
