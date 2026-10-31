// What has to be inline in every page's HTML: the theme script and the view-transition opt-in. They're
// plain strings so that astro.config.mjs can put their hashes in the Content-Security-Policy (Astro
// hashes the scripts and styles it bundles itself, but not inline ones).

/**
 * The saved (or system) theme and motion setting, before anything paints. A saved theme also picks
 * the matching favicon; without one, favicon.svg follows the system's light or dark setting itself.
 *
 * It also keeps a foldable that was half-open last time from showing the ordinary layout for a
 * moment: Chrome can report the fold's segments a little after the first paint (or, for a
 * prerendered page, once it's shown), so the page waits for them, up to 300 ms (base.css). The
 * moment they arrived is kept in data-fold-at, for the preview bar.
 *
 * And the sidebar keeps its scroll position from page to page (saved as a page is left, put back
 * before the next one is shown).
 */
export const THEME_BOOT = `try{var d=document.documentElement,t=localStorage.getItem('theme'),l=t?t==='light':matchMedia('(prefers-color-scheme: light)').matches;d.dataset.theme=l?'light':'dark';if(localStorage.getItem('motion')==='off')d.dataset.motion='off';if(t){document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content=m.dataset[l?'light':'dark']});var f=document.querySelector('link[rel="icon"]');if(f)f.href=f.href.replace(/favicon(-dark|-light)?\\.svg/,'favicon-'+(l?'light':'dark')+'.svg')}}catch(e){}
function vt(e){var v=e.viewTransition;if(e.type==='pagereveal')d.dataset.vt=v?'yes':'no';if(!v)return;[v.ready,v.finished,v.updateCallbackDone].forEach(function(p){p&&p.catch(function(){})});try{if(localStorage.getItem('motion')==='off')v.skipTransition()}catch(x){}}
addEventListener('pageswap',vt);addEventListener('pagereveal',vt);
function side(){return document.querySelector('.side .inner')}
function keep(){try{var s=side();if(s)sessionStorage.setItem('side',String(s.scrollTop))}catch(x){}}
function put(){try{var s=side(),y=sessionStorage.getItem('side');if(s&&y)s.scrollTop=+y}catch(x){}}
addEventListener('pageswap',keep);addEventListener('pagehide',keep);addEventListener('pagereveal',put);addEventListener('DOMContentLoaded',put);
try{var q=matchMedia('(horizontal-viewport-segments: 2), (vertical-viewport-segments: 2)'),k='fold',
fs=function(){try{localStorage.setItem(k,q.matches?'split':'')}catch(x){}},
t0=0,go=function(){if(d.dataset.foldWait!==undefined)d.dataset.foldWaited=String(Math.round(performance.now()-t0));delete d.dataset.foldWait},
w=function(){t0=performance.now();if(q.matches)go();else setTimeout(function(){go();fs()},300)};
q.addEventListener('change',function(){if(q.matches){d.dataset.foldAt=Math.round(performance.now());go()}fs()});
if(q.matches)d.dataset.foldAt='0';
if(!q.matches&&localStorage.getItem(k)==='split'){d.dataset.foldWait='';document.prerendering?addEventListener('prerenderingchange',w,{once:true}):w()}else fs()}catch(e){}`;

/**
 * Cross-document view transitions (a cross-fade between pages), opted into before anything else
 * in the head, so the page has opted in by the time it's first shown. The script above skips the
 * transition when animations are paused, and keeps a skipped one from reporting an error.
 */
export const NAV_CSS = '@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}';

export const INLINE_SCRIPTS = [THEME_BOOT];
