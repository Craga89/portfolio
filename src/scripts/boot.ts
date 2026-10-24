// Runs on every page.
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

// Offline support and instant repeat visits (https only, so local previews aren't cached).
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
