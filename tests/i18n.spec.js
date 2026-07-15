// @ts-check
// Live check that the bar's UI localizes with the browser UI language.
// chrome.i18n resolves from Chromium's --lang (not the Google domain), so we
// launch a context per language and assert the leading "Any time" chip renders
// its translated value — one Latin locale (de) and one CJK locale (ja) to
// confirm non-ASCII messages survive the whole path into the DOM.
const path = require('path');
const os = require('os');
const fs = require('fs');
const { test, chromium, expect } = require('@playwright/test');
const {
	gotoSearch,
	dismissConsentIfPresent,
	waitForHumanIfCaptcha,
	SRC_DIR,
} = require('./fixtures/extension');

function expectedAnyTime(locale) {
	const file = path.join(SRC_DIR, '_locales', locale, 'messages.json');
	return JSON.parse(fs.readFileSync(file, 'utf8')).anyTime.message;
}

// The extension test fixture is fixed to en-US; this spec needs its own
// per-language context, so it drives chromium.launchPersistentContext directly.
async function launchLocalized(lang) {
	const profileDir = path.join(os.tmpdir(), `sdb-i18n-${lang}`);
	const context = await chromium.launchPersistentContext(profileDir, {
		headless: false,
		locale: lang,
		viewport: { width: 1280, height: 900 },
		args: [
			`--lang=${lang}`,
			`--disable-extensions-except=${SRC_DIR}`,
			`--load-extension=${SRC_DIR}`,
		],
	});
	return context;
}

for (const { lang, locale } of [
	{ lang: 'de', locale: 'de' },
	{ lang: 'ja', locale: 'ja' },
]) {
	test(`bar UI localizes to ${lang}`, async () => {
		const context = await launchLocalized(lang);
		const page = context.pages()[0] ?? (await context.newPage());
		try {
			await gotoSearch(page, 'coffee');
			await waitForHumanIfCaptcha(page);
			await dismissConsentIfPresent(page);

			const firstChip = page.locator('.time-ul .time-li').first();
			await expect(firstChip).toHaveText(expectedAnyTime(locale), { timeout: 15000 });
		} finally {
			await context.close();
		}
	});
}
