// Tells IndexNow (Bing, Yandex, Seznam, Naver, Yep) which pages changed in this deploy. Run by the
// CI deploy after Pages has published, with the site as last deployed and as just deployed:
//   node tools/indexnow.mjs <last deployed site> <new site> <origin>
import { changedUrls, submit } from './lib/indexnow.mjs';

const [oldDir, newDir, site] = process.argv.slice(2);
const urls = changedUrls(oldDir, newDir, site);
const status = await submit(urls, site);
console.log(
  urls.length ? `IndexNow: ${urls.length} page(s), HTTP ${status}\n${urls.join('\n')}` : 'IndexNow: no pages changed',
);
// 200 and 202 mean accepted; anything else is reported but doesn't fail the deploy.
if (status && status !== 200 && status !== 202) console.log(`::warning::IndexNow answered HTTP ${status}`);
