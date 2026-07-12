// @ts-check
// Drives real, live google.com search pages with the unpacked extension
// loaded. Uses a persistent throwaway profile (not real user data), and
// Playwright's bundled Chromium since branded Chrome ignores --load-extension.
const path = require('path');
const os = require('os');
const { test: base, chromium, expect } = require('@playwright/test');

const SRC_DIR = path.resolve(__dirname, '../../src');
const PROFILE_DIR = path.join(os.tmpdir(), 'sdb-fresh-profile');

/** @param {boolean} extensionEnabled */
function makeExtensionTest(extensionEnabled) {
	return base.extend({
		context: async ({}, use) => {
			const args = extensionEnabled
				? [`--disable-extensions-except=${SRC_DIR}`, `--load-extension=${SRC_DIR}`]
				: ['--disable-extensions'];
			const context = await chromium.launchPersistentContext(PROFILE_DIR, {
				headless: false,
				locale: 'en-US',
				viewport: { width: 1280, height: 900 },
				args,
			});
			await use(context);
			await context.close();
		},
		page: async ({ context }, use) => {
			const page = context.pages()[0] ?? (await context.newPage());
			await use(page);
		},
	});
}

// Extension loaded — the common case for regression tests.
const test = makeExtensionTest(true);

// Extension NOT loaded — used for A/B comparisons.
const testWithoutExtension = makeExtensionTest(false);

/** @param {import('@playwright/test').Page} page */
async function isCaptchaWall(page) {
	const url = page.url();
	if (url.includes('/sorry/')) return true;
	const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
	return /unusual traffic|detected unusual/i.test(bodyText);
}

/**
 * Pauses and waits for a human to solve a CAPTCHA in the visible browser
 * window if one appears. Never proceeds through a CAPTCHA automatically.
 * @param {import('@playwright/test').Page} page
 * @param {number} [maxWaitMs]
 */
async function waitForHumanIfCaptcha(page, maxWaitMs = 5 * 60 * 1000) {
	if (!(await isCaptchaWall(page))) return;
	console.log('\n>>> CAPTCHA detected. Please solve it manually in the open browser window.');
	console.log('>>> Waiting up to 5 minutes — resumes automatically once solved.\n');
	const start = Date.now();
	while (Date.now() - start < maxWaitMs) {
		await page.waitForTimeout(2000);
		if (!(await isCaptchaWall(page))) {
			console.log('>>> CAPTCHA cleared, continuing.\n');
			return;
		}
	}
	throw new Error('Timed out waiting for CAPTCHA to be solved.');
}

/**
 * Clicks through Google's cookie-consent interstitial if it appears.
 * @param {import('@playwright/test').Page} page
 */
async function dismissConsentIfPresent(page) {
	const candidates = [
		page.getByRole('button', { name: /Accept all/i }),
		page.getByRole('button', { name: /I agree/i }),
		page.getByRole('button', { name: /Reject all/i }),
	];
	for (const locator of candidates) {
		try {
			if (await locator.first().isVisible({ timeout: 2000 })) {
				await locator.first().click();
				await page.waitForTimeout(500);
				return;
			}
		} catch {
			// Not present — try the next candidate.
		}
	}
}

/**
 * Navigates to a real, live Google search results page.
 * @param {import('@playwright/test').Page} page
 * @param {string} query
 * @param {string} [extraParams]
 */
async function gotoSearch(page, query, extraParams = '') {
	await page.goto(
		`https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&gl=us${extraParams}`
	);
	await waitForHumanIfCaptcha(page);
	await dismissConsentIfPresent(page);
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1000);
	await waitForHumanIfCaptcha(page);
	await dismissConsentIfPresent(page);
}

module.exports = {
	test,
	testWithoutExtension,
	expect,
	gotoSearch,
	dismissConsentIfPresent,
	waitForHumanIfCaptcha,
	SRC_DIR,
};
