// token-fetcher.js
const fs    = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  const PROFILE    = '/data/browser-profile';
  const TOKEN_FILE = '/data/token.txt';

  // ensure we have a place for cookies/profile
  fs.mkdirSync(PROFILE, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: [ '--no-sandbox', '--disable-setuid-sandbox' ],
    userDataDir: PROFILE
  });

  const page = await browser.newPage();

  // 1) Go to the login page to initialize the session or pick up cookies
  await page.goto('https://app.gohighlevel.com/login', { waitUntil: 'networkidle2' });

  // 2) If we see the login form, perform login
  if (await page.$('input[name="email"]')) {
    console.log('🔑 Logging in with credentials...');
    await page.type('input[name="email"]', process.env.GHL_EMAIL, { delay: 50 });
    await page.type('input[name="password"]', process.env.GHL_PASSWORD, { delay: 50 });
    await page.click('button[type=submit]');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('✅ Logged in (OTP complete if needed).');
  } else {
    console.log('🔄 Using existing session—no OTP needed.');
  }

  // 3) Now navigate to the main app where getToken() is defined
  await page.goto('https://app.gohighlevel.com', { waitUntil: 'networkidle2' });
  console.log('🔄 Navigated to dashboard, extracting token…');

  // 4) Grab the token
  const token = await page.evaluate(() => {
    if (typeof getToken === 'function') return getToken();
    if (window.getToken)            return window.getToken();
    return null;
  });

  if (!token) {
    console.error('❌ getToken() not found or returned empty.');
    await browser.close();
    process.exit(1);
  }

  // 5) Write it out
  fs.writeFileSync(TOKEN_FILE, token, 'utf8');
  console.log(`✅ Wrote new token to ${TOKEN_FILE}`);

  await browser.close();
  process.exit(0);
})();
