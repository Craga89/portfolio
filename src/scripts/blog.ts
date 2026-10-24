// "show all posts": the rest of the blog list, in place.
import { $, $$ } from './dom';

const more = $<HTMLButtonElement>('[data-blog-more]');
more?.addEventListener('click', () => {
  const hidden = $$('#blog li[hidden]');
  for (const li of hidden) li.hidden = false;
  more.setAttribute('aria-expanded', 'true');
  more.hidden = true;
  // Focus moves to the first post that wasn't showing.
  hidden[0]?.querySelector('a')?.focus();
});
