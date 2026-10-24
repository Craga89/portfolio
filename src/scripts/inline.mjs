// What has to be inline in every page's HTML: two scripts and the view-transition opt-in. They're
// plain strings so that astro.config.mjs can put their hashes in the Content-Security-Policy (Astro
// hashes the scripts and styles it bundles itself, but not inline ones).

/** The saved (or system) theme and motion setting, before anything paints. */
export const THEME_BOOT = `try{var d=document.documentElement,t=localStorage.getItem('theme'),l=t?t==='light':matchMedia('(prefers-color-scheme: light)').matches;d.dataset.theme=l?'light':'dark';if(localStorage.getItem('motion')==='off')d.dataset.motion='off';if(t)document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content=m.dataset[l?'light':'dark']})}catch(e){}
function vt(e){var v=e.viewTransition;if(!v)return;[v.ready,v.finished,v.updateCallbackDone].forEach(function(p){p&&p.catch(function(){})});try{if(localStorage.getItem('motion')==='off')v.skipTransition()}catch(x){}}
addEventListener('pageswap',vt);addEventListener('pagereveal',vt);`;

/**
 * Cross-document view transitions (a cross-fade between pages), opted into before anything else
 * in the head, so the page has opted in by the time it's first shown. The script above skips the
 * transition when animations are paused, and keeps a skipped one from reporting an error.
 */
export const NAV_CSS = '@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}';

const CF_ANALYTICS_TOKEN = '1115308102a141bdb2e944bd0144d4ee';

/**
 * Cloudflare Web Analytics: cookieless page views, only on the live site, not for Do Not Track or
 * Global Privacy Control, and only once the page is shown and the visitor does something (or 6s
 * after load), so it never competes with the page for the network.
 */
export const ANALYTICS = `(function load(){if(document.prerendering){document.addEventListener('prerenderingchange',load,{once:true});return}
if(!/(^|\\.)craigthompson\\.dev$/.test(location.hostname)||navigator.globalPrivacyControl||navigator.doNotTrack==='1')return;
var ev=['pointerdown','keydown','wheel','touchstart','scroll'],done=false;
function once(){if(done)return;done=true;ev.forEach(function(e){removeEventListener(e,once,true)});var s=document.createElement('script');s.defer=true;s.src='https://static.cloudflareinsights.com/beacon.min.js';s.dataset.cfBeacon=JSON.stringify({token:'${CF_ANALYTICS_TOKEN}'});document.head.append(s)}
ev.forEach(function(e){addEventListener(e,once,{capture:true,passive:true})});
function later(){setTimeout(once,6000)}if(document.readyState==='complete')later();else addEventListener('load',later,{once:true})})()`;

export const INLINE_SCRIPTS = [THEME_BOOT, ANALYTICS];
