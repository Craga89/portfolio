// The call to action at the foot of a file's page.
import Cta from '../../components/page/Cta.astro';

export default { component: Cta };

export const CaseStudy = { args: { home: '/?case=a11y#case-studies' } };
export const BlogPost = { args: { home: '/#blog', homeText: 'the portfolio' } };
