// The path at the top of a file's page.
import Crumb from '../../components/page/Crumb.astro';

export default { component: Crumb };

export const CaseStudy = {
  args: { folder: 'case-studies/', file: 'accessibility.md', home: '/?case=a11y#case-studies' },
};
export const BlogPost = {
  args: { folder: 'blog/', file: '60fps-scrolling-using-pointer-events-none.md', home: '/blog/' },
};
