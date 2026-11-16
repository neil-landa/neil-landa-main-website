// Runs in the deploy workflow. Fetches the content saved in /admin/ from the live API and
// writes it to assets/content.js, so the page has the saved text the moment it loads
// instead of waiting on the API (which can take a few seconds to wake up).
// Sets the step output "changed" to say whether it differs from what the live site serves.
import { writeFileSync, appendFileSync } from 'node:fs';

const SITE = (process.env.SITE_URL || 'https://neillanda.com').replace(/\/$/, '');
const OUT = new URL('../assets/content.js', import.meta.url);

async function get(url, tries) {
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'Cache-Control': 'no-cache' } });
      if (res.ok) return await res.text();
      console.log(`${url}: HTTP ${res.status} (try ${i})`);
    } catch (err) {
      console.log(`${url}: ${err.message} (try ${i})`);
    }
    if (i < tries) await new Promise((r) => setTimeout(r, 5000));
  }
  return null;
}

let js = '// Filled in at deploy time with the content saved in /admin/.\nwindow.__baked = null;\n';
const body = await get(`${SITE}/api/content`, 5);
try {
  const data = body && JSON.parse(body);
  if (data && data.content) {
    js = '// Generated at deploy time from /api/content. Do not edit.\nwindow.__baked = ' + JSON.stringify(data) + ';\n';
  } else {
    console.log('No saved content fetched; the page will fall back to the built-in defaults.');
  }
} catch (err) {
  console.log('Could not parse /api/content:', err.message);
}
writeFileSync(OUT, js);

const live = await get(`${SITE}/assets/content.js`, 2);
const changed = live !== js;
console.log(changed ? 'Saved content differs from the live copy.' : 'Live copy is already up to date.');
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
