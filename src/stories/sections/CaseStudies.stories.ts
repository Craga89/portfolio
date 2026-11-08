// The home page's <CaseStudies> section.
import CaseStudies from '../../components/sections/CaseStudies.astro';
import Glossary from '../Glossary.astro';

export default { component: CaseStudies };

// Its terms open the shared definition popover.
const decorators = [{ component: Glossary }];

export const CaseStudies_ = { decorators };
