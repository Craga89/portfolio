// The sidebar: on the home page, and beside a case study (its folder open, the page marked).
import Sidebar from '../../components/home/Sidebar.astro';

export default { component: Sidebar };

export const Home = {};
export const CaseStudy = {
  args: {
    file: {
      folder: 'case-studies/',
      current: 1,
      files: [
        { file: 'monorepo.md', href: '/case-studies/monorepo/' },
        { file: 'accessibility.md', href: '/case-studies/accessibility/' },
        { file: 'i18n.md', href: '/case-studies/i18n/' },
      ],
    },
  },
};
