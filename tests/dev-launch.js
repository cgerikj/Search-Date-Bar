// Manual dev tool: opens google.com with the unpacked extension loaded and
// leaves the browser open for manual testing.
// Run: node tests/dev-launch.js
const path = require('path');
const os = require('os');
const { chromium } = require('@playwright/test');

const PROFILE_DIR = path.join(os.tmpdir(), 'sdb-fresh-profile');
const SRC_DIR = path.resolve(__dirname, '../src');
const QUERY = process.argv[2] || 'google';

(async () => {
	const context = await chromium.launchPersistentContext(PROFILE_DIR, {
		headless: false,
		viewport: null, // maximized/whatever size the window opens at, not fixed
		args: [
			`--disable-extensions-except=${SRC_DIR}`,
			`--load-extension=${SRC_DIR}`,
			'--start-maximized',
		],
	});
	const page = context.pages()[0] ?? (await context.newPage());
	await page.goto(`https://www.google.com/search?q=${encodeURIComponent(QUERY)}&hl=en&gl=us`);
	console.log('Browser open with the extension loaded — close the window when done.');
	await new Promise((resolve) => context.on('close', resolve));
})();
