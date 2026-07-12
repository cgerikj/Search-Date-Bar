// @ts-check
const { test, expect, gotoSearch } = require('./fixtures/extension');

test.describe('extension insertion + resilience', () => {
	test('inserts the date bar without throwing, despite dead legacy selectors', async ({ page }) => {
		await gotoSearch(page, 'google');

		// Listen only after navigation has settled, so errors from Google's own scripts aren't misattributed.
		const errors = [];
		page.on('pageerror', (err) => errors.push(err.message));

		await page.waitForTimeout(500);

		expect(errors).toEqual([]);

		const barIsAttached = await page.evaluate(() => {
			const bar = document.querySelector('.time-ul');
			return !!bar && document.body.contains(bar);
		});
		expect(barIsAttached).toBe(true);
	});

	test('does not insert anything on the Images results page (tbm=isch)', async ({ page }) => {
		await gotoSearch(page, 'google', '&tbm=isch');
		await page.waitForTimeout(500);

		await expect(page.locator('.time-ul')).toHaveCount(0);
	});
});
