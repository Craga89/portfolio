// Build steps that need the finished site: social images, the PDF CV, the service worker.
/** @param {{ indexing: boolean }} options @returns {import('astro').AstroIntegration} */
export function postBuild({ indexing }) {
  return {
    name: 'craigthompson:post-build',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        void indexing;
        logger.info('post-build: ' + dir.pathname);
      },
    },
  };
}
