// index.js (extractor)
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const prompt = require('prompt-sync')();

const TOKEN_PATH = '/data/token.txt';
const PROFILE    = '/data/browser-profile';

async function loadToken() {
  if (!fs.existsSync(TOKEN_PATH)) {
    console.error('❌ No token found—run the token-fetcher first.');
    process.exit(1);
  }
  return fs.readFileSync(TOKEN_PATH, 'utf8').trim();
}

(async () => {
  let token = await loadToken();
  const progressFile = '/data/progress.json';
  const rawDir       = '/data/raw';

  fs.mkdirSync(rawDir, { recursive: true });
  let progress = fs.existsSync(progressFile)
    ? JSON.parse(fs.readFileSync(progressFile))
    : { page: 1, index: 0 };

  // Example: fetch contact summary pages
  while (true) {
    try {
      const res = await axios.get(
        `https://rest.gohighlevel.com/v2/contacts?page=${progress.page}&limit=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.status === 401) {
        console.log('🔑 Token expired—please wait for the next token-fetcher run.');
        process.exit(0);
      }
      if (res.data.contacts.length === 0) break;

      // save raw page
      fs.writeFileSync(
        path.join(rawDir, `contacts-page-${progress.page}.json`),
        JSON.stringify(res.data, null, 2)
      );
      console.log(`✅ Saved page ${progress.page}`);

      // advance page
      progress.page++;
      fs.writeFileSync(progressFile, JSON.stringify(progress));
    } catch (e) {
      if (e.response && e.response.status === 429) {
        console.log('⚠️ Rate limited—waiting 10s...');
        await new Promise(r => setTimeout(r, 10000));
      } else {
        console.error('❌ Unhandled error:', e.message);
        process.exit(1);
      }
    }
  }

  console.log('🎉 All pages fetched.');
})();
