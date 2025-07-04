// token-fetcher.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const profilePath = '/data/browser-profile';
  const tokenFile   = '/data/token.txt';

  // ensure profile dir exists
  fs.mkdirSync(profilePath, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: [ '--no-sandbox', '--disable-setuid-sandbox' ],
    userDataDir: profilePath
  });

  const page = await browser.newPage();
  await page.goto('https://app.gohighlevel.com/login', { waitUntil: 'networkidle2' });

  // if already logged in (cookie exists), skip login
  if (await page.$('input[name="email"]')) {
    await page.type('input[name="email"]', process.env.GHL_EMAIL,   { delay: 50 });
    await page.type('input[name="password"]', process.env.GHL_PASSWORD, { delay: 50 });
    await page.click('button[type=submit]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('✅ Logged in and OTP complete manually (first run).');
  } else {
    console.log('🔄 Using existing session—no OTP needed.');
  }

  // now grab token in page context
  const token = await page.evaluate(() => window.getToken && getToken());
  if (!token) {
    console.error('❌ getToken() not found or returned empty.');
    process.exit(1);
  }

  fs.writeFileSync(tokenFile, token, 'utf8');
  console.log(`✅ Wrote new token to ${tokenFile}`);

  await browser.close();
  process.exit(0);
})();
