const fs = require('fs');
const path = require('path');
const axios = require('axios');
const puppeteer = require('puppeteer');
const prompt = require('prompt-sync')();

const TOKEN_PATH = '/data/token.txt';
const PROFILE    = '/data/browser-profile';
const PROGRESS   = '/data/progress.json';
const RAW_DIR    = '/data/raw';

async function refreshToken() {
  console.log('🔄 Refreshing token via headless Chrome…');
  fs.mkdirSync(PROFILE, { recursive: true });
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox'],
    userDataDir: PROFILE
  });
  const page = await browser.newPage();
  await page.goto('https://app.gohighlevel.com/login', { waitUntil: 'networkidle2' });

  if (await page.$('input[name="email"]')) {
    console.log('➡️ Complete OTP in the opened browser to persist session.');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
  }

  const token = await page.evaluate(() => window.getToken && getToken());
  if (!token) throw new Error('getToken() failed');

  fs.writeFileSync(TOKEN_PATH, token, 'utf8');
  console.log('✅ Token refreshed.');
  await browser.close();
}

async function safeGet(url) {
  let token;
  try {
    token = fs.readFileSync(TOKEN_PATH, 'utf8').trim();
  } catch {
    console.log('🔑 No token found, refreshing now...');
    await refreshToken();
    token = fs.readFileSync(TOKEN_PATH, 'utf8').trim();
  }

  let res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } })
    .catch(e => e.response || { status: 500, data: e.message });

  if (res.status === 401) {
    await refreshToken();
    token = fs.readFileSync(TOKEN_PATH, 'utf8').trim();
    console.log('🔁 Retrying request with new token…');
    res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } })
      .catch(e => e.response || { status: 500, data: e.message });
  }

  return res;
}

(async () => {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  let progress = { page: 1 };

  if (fs.existsSync(PROGRESS)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS, 'utf8'));
  }

  while (true) {
    try {
      const url = `https://rest.gohighlevel.com/v2/contacts?page=${progress.page}&limit=100`;
      const res = await safeGet(url);

      const contacts = res.data.contacts || [];
      if (contacts.length === 0) {
        console.log('🎉 No more contacts to fetch.');
        break;
      }

      fs.writeFileSync(
        path.join(RAW_DIR, `contacts-page-${progress.page}.json`),
        JSON.stringify(res.data, null, 2)
      );
      console.log(`✅ Saved contacts-page-${progress.page}.json (${contacts.length} contacts)`);

      progress.page++;
      fs.writeFileSync(PROGRESS, JSON.stringify(progress, null, 2));

      // Optionally, add a short delay between pages to be gentle
      await new Promise(r => setTimeout(r, 500));

    } catch (e) {
      if (e.response && e.response.status === 429) {
        console.log('⚠️ Rate limited—waiting 10s...');
        await new Promise(r => setTimeout(r, 10000));
      } else {
        console.error('❌ Fatal error:', e.message);
        process.exit(1);
      }
    }
  }

  console.log('✅ Extraction complete.');
})();
