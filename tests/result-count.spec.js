// @ts-check
const { test, expect, gotoSearch } = require('./fixtures/extension');

test.describe('result count readout', () => {
	test('renders a shortened count from Google\'s #result-stats', async ({ page }) => {
		await gotoSearch(page, 'coffee');
		await page.waitForTimeout(500);

		// Source: Google's own (hidden) result-stats element, e.g.
		// "About 3,040,000,000 results (0.47s)".
		const raw = (await page.locator('#result-stats').textContent()) || '';
		expect(raw).toMatch(/\d/);

		// Our readout: "~" + a short-scale abbreviation (~3B, ~151M, ~1.2K, ~42).
		const readout = page.locator('.time-li-count');
		await expect(readout).toBeVisible();
		await expect(readout).toHaveText(/^~\d[\d.]*[KMBT]?$/);
	});

	// On knowledge-panel-heavy pages Google adds #result-stats after our
	// script runs; the readout must still fill in once it appears.
	test('fills in even when #result-stats loads late', async ({ page }) => {
		await gotoSearch(page, 'google');
		await page.waitForTimeout(500);

		const readout = page.locator('.time-li-count');
		await expect(readout).toBeVisible();
		await expect(readout).toHaveText(/^~\d[\d.]*[KMBT]?$/);
	});
});
