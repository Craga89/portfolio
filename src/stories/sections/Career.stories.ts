// The home page's <Career> section.
import Career from '../../components/sections/Career.astro';
import Glossary from '../Glossary.astro';

export default { component: Career };

// Its terms open the shared definition popover.
const decorators = [{ component: Glossary }];

export const Career_ = { decorators };
