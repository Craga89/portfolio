// Under a file's page: the previous and next files, the folder's files and the call to action.
import FileFooter from '../../components/page/FileFooter.astro';

export default { component: FileFooter };

export const FileFooter_ = {
  args: {
    folder: 'case-studies/',
    current: 1,
    home: '/?case=a11y#case-studies',
    files: [
      { file: 'monorepo.md', href: '/case-studies/monorepo/' },
      { file: 'accessibility.md', href: '/case-studies/accessibility/' },
      { file: 'i18n.md', href: '/case-studies/i18n/' },
    ],
  },
};
