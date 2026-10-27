// Runs on every page.
import { PREVIEW, url } from '../lib/url';
import './theme';
import './motion';
import './copy';
import './keys';
import './tips';
import './clock';
import './built';
import './i18n';
import './visits';
import './console';

// Offline support and instant repeat visits (https only, so local builds aren't cached, and not for
// a branch preview, which is only ever looked at once).
if ('serviceWorker' in navigator && location.protocol === 'https:' && !PREVIEW) {
  addEventListener('load', () => navigator.serviceWorker.register(url('/sw.js')).catch(() => {}));
}
