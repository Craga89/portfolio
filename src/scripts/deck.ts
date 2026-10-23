// The responsibilities tour: plays through each file while it's on screen, holds while it's
// hovered, focused or paused, and stops for good once the visitor picks a file. The progress
// bar is a CSS animation; when it ends, the tour moves on.
import { $, $$, motionOk } from './dom';
import { Tabs, swipe } from './tabs';

const deck = $('#r-deck');

export let tour: Tabs | null = null;
/** Stop the tour playing (the visitor chose a file). */
export let holdTour = () => {};

if (deck) {
  const nextLabel = $('[data-deck-next-label]', deck);
  const play = $<HTMLButtonElement>('[data-deck-play]', deck);
  const t = (tour = new Tabs(deck, {
    perma: $<HTMLAnchorElement>('[data-deck-perma]'),
    onChange: (i) => {
      t.tabs.forEach((tab, j) => tab.toggleAttribute('data-seen', j < i));
      if (nextLabel) nextLabel.textContent = 'next: ' + t.tabs[(i + 1) % t.tabs.length].getAttribute('aria-label');
      restart();
    },
  }));

  let stopped = false;
  let visible = false;
  let hovered = false;
  let focused = false;

  const sync = () => {
    const can = motionOk() && !stopped;
    if (play) {
      play.hidden = !motionOk();
      play.setAttribute('aria-pressed', String(can));
    }
    deck.toggleAttribute('data-playing', can);
    deck.toggleAttribute('data-paused', !(visible && !hovered && !focused));
    // While it plays, file changes aren't announced (they'd interrupt every 10s).
    $('.slides', deck)?.setAttribute('aria-live', can && visible ? 'off' : 'polite');
  };
  // A fresh fill for the newly shown file.
  const restart = () => {
    deck.removeAttribute('data-playing');
    void deck.offsetWidth;
    sync();
  };
  holdTour = () => {
    stopped = true;
    sync();
  };

  deck.addEventListener('animationend', (e) => {
    if ((e.target as Element).closest('.seg[aria-selected="true"]')) t.step(1);
  });
  new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting);
    sync();
  }, { threshold: 0.35 }).observe(deck);
  deck.addEventListener('mouseenter', () => ((hovered = true), sync()));
  deck.addEventListener('mouseleave', () => ((hovered = false), sync()));
  deck.addEventListener('focusin', () => ((focused = true), sync()));
  deck.addEventListener('focusout', (e) => {
    if (!deck.contains(e.relatedTarget as Node)) {
      focused = false;
      sync();
    }
  });
  addEventListener('craga:motion', sync);

  // Choosing a file stops the tour.
  deck.addEventListener('click', (e) => {
    const b = (e.target as Element).closest('button');
    if (!b) return;
    if (b.matches('[data-deck-play]')) {
      stopped = !stopped;
      sync();
      return;
    }
    if (b.matches('[role="tab"]')) holdTour();
    if (b.matches('[data-deck-prev]')) t.step(-1);
    if (b.matches('[data-deck-next]')) t.step(1);
  });
  // ← and → step through the files from anywhere in the tour (not inside a summary's space key).
  deck.addEventListener('keydown', (e) => {
    if ((e.target as Element).closest('[role="tablist"]')) return;
    const rtl = document.documentElement.dir === 'rtl';
    const by = e.key === (rtl ? 'ArrowLeft' : 'ArrowRight') ? 1 : e.key === (rtl ? 'ArrowRight' : 'ArrowLeft') ? -1 : 0;
    if (!by) return;
    e.preventDefault();
    t.step(by);
  });
  swipe($('.slides', deck), (by) => t.step(by));
  for (const tab of $$('[role="tab"]', deck)) tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
  sync();
}
