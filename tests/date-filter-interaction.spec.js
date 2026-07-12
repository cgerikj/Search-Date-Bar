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

	test('clicking "Range" toggles the custom-range popup open and closed', async ({ page }) => {
		await gotoSearch(page, 'google');
		await page.waitForTimeout(500);

		const popup = page.locator('#custom-range-popup');
		await expect(popup).toBeHidden();

		await page.getByText('Range', { exact: true }).click();
		await expect(popup).toBeVisible();

		await page.getByText('Range', { exact: true }).click();
		await expect(popup).toBeHidden();
	});

	test('filling in a custom range and clicking Go navigates with the correct tbs', async ({
		page,
	}) => {
		await gotoSearch(page, 'google');
		await page.waitForTimeout(500);

		await page.getByText('Range', { exact: true }).click();
		await expect(page.locator('#custom-range-popup')).toBeVisible();

		await page.fill('#custom-start', '2024-01-01');
		await page.fill('#custom-end', '2024-06-15');
		await page.click('#custom-range-button');
		await page.waitForLoadState('load');

		const url = new URL(page.url());
		const tbs = url.searchParams.get('tbs');
		expect(tbs).toContain('cdr:1');
		// The URL param stays in Google's required MM/DD/YYYY format...
		expect(tbs).toContain('cd_min:01/01/2024');
		expect(tbs).toContain('cd_max:06/15/2024');

		// Label shows ISO 8601 instead, since MM/DD/YYYY isn't universally understood.
		await expect(page.getByText('2024-01-01 – 2024-06-15', { exact: true })).toBeVisible();
	});

	test('clicking inside the popup (the date input) does not close it', async ({ page }) => {
		await gotoSearch(page, 'google');
		await page.waitForTimeout(500);

		await page.getByText('Range', { exact: true }).click();
		const popup = page.locator('#custom-range-popup');
		await expect(popup).toBeVisible();

		await page.click('#custom-start');
		await expect(popup).toBeVisible();

		await page.click('#custom-end');
		await expect(popup).toBeVisible();
	});

	test('"Range" trigger is keyboard-operable and exposes aria-expanded', async ({ page }) => {
		await gotoSearch(page, 'google');
		await page.waitForTimeout(500);

		const trigger = page.locator('.time-li-range');
		const popup = page.locator('#custom-range-popup');

		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
		await expect(trigger).toHaveAttribute('aria-haspopup', 'true');

		await trigger.focus();
		await page.keyboard.press('Enter');
		await expect(popup).toBeVisible();
		await expect(trigger).toHaveAttribute('aria-expanded', 'true');

		await page.keyboard.press('Enter');
		await expect(popup).toBeHidden();
		await expect(trigger).toHaveAttribute('aria-expanded', 'false');
	});
});
