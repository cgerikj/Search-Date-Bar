// @ts-check
const { test, expect, gotoSearch } = require('./fixtures/extension');

test.describe('date filter interaction', () => {
	test('"Any time" is selected by default when no tbs param is present', async ({ page }) => {
		await gotoSearch(page, 'google');
		await page.waitForTimeout(500);

		await expect(page.locator('#qdr_')).toHaveClass(/time-li-sel/);
	});

	test('clicking "1d" navigates with tbs=qdr:d', async ({ page }) => {
		await gotoSearch(page, 'google');
		await page.waitForTimeout(500);

		await page.click('#qdr_d a');
		await page.waitForLoadState('load');

		const url = new URL(page.url());
		expect(url.searchParams.get('tbs')).toBe('qdr:d');
	});

	test('clicking "Range" opens Google\'s native custom-range modal', async ({ page }) => {
		await gotoSearch(page, 'google');
		await page.waitForTimeout(500);

		// The native "Custom date range" dialog exists hidden until triggered.
		const modal = page.getByText('Custom date range', { exact: true });
		await expect(modal).toBeHidden();

		await page.getByText('Range', { exact: true }).click();
		await expect(modal).toBeVisible();
	});

	test('"Range" is keyboard-operable and opens the native modal', async ({ page }) => {
		await gotoSearch(page, 'google');
		await page.waitForTimeout(500);

		const trigger = page.locator('.time-li-range');
		await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');

		await trigger.focus();
		await page.keyboard.press('Enter');
		await expect(page.getByText('Custom date range', { exact: true })).toBeVisible();
	});
});
