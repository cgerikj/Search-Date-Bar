// @ts-check
const { test, expect, gotoSearch } = require('./fixtures/extension');

test.describe('horizontal positioning', () => {
	for (const query of ['google', 'reddit']) {
		test(`"${query}": injected bar's left edge matches the results column, not the raw viewport edge`, async ({
			page,
		}) => {
			await gotoSearch(page, query);
			await page.waitForTimeout(500);

			const positions = await page.evaluate(() => {
				const centerCol = document.getElementById('center_col');
				const bar = document.querySelector('.time-ul');
				return {
					centerColX: centerCol ? centerCol.getBoundingClientRect().x : null,
					barX: bar ? bar.getBoundingClientRect().x : null,
				};
			});

			expect(positions.centerColX).not.toBeNull();
			expect(positions.barX).not.toBeNull();
			expect(Math.abs(positions.barX - positions.centerColX)).toBeLessThanOrEqual(2);
		});
	}
});
