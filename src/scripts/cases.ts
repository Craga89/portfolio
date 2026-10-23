// The case studies' tabs.
import { $ } from './dom';
import { Tabs, swipe } from './tabs';

const box = $('[data-tabs]');
export const cases = box ? new Tabs(box, { perma: $<HTMLAnchorElement>('[data-tabs-perma]') }) : null;
if (cases) swipe($('.panels', box!), (by) => cases.step(by));
