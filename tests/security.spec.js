// @ts-check
// cd_min comes straight from the URL's tbs param; a crafted value must not break out of an attribute.
const { test, expect, gotoSearch } = require('./fixtures/extension');

test.describe('XSS hardening', () => {
	test('a crafted cd_min payload does not inject an executable attribute/element', async ({
		page,
	}) => {
		const payload = '1/1/1" onmouseover="window.__xssFired=true" foo="';
		await gotoSearch(
			page,
			'google',
			`&tbs=${encodeURIComponent(`cdr:1,cd_min:${payload}`)}`
		);
		await page.waitForTimeout(500);

		const result = await page.evaluate(() => ({
			hasInjectedHandler: !!document.querySelector('[onmouseover]'),
			xssFired: window.__xssFired === true,
		}));

		expect(result.hasInjectedHandler).toBe(false);
		expect(result.xssFired).toBe(false);
	});
});
