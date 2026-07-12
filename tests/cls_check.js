// Manual dev tool: prints CLS for a google.com search, with and without the extension.
// Run: node tests/cls_check.js
const path = require('path');
const { chromium } = require('@playwright/test');

const PROFILE_DIR = path.join(require('os').tmpdir(), 'sdb-fresh-profile');
const SRC_DIR = path.resolve(__dirname, '../src');

async function measure(extensionEnabled) {
	const args = extensionEnabled
		? [`--disable-extensions-except=${SRC_DIR}`, `--load-extension=${SRC_DIR}`]
		: ['--disable-extensions'];
	const context = await chromium.launchPersistentContext(PROFILE_DIR, {
		headless: false,
		viewport: { width: 1280, height: 900 },
		args,
	});
	const page = context.pages()[0] ?? (await context.newPage());

	await page.addInitScript(() => {
		window.__clsEntries = [];
		try {
			new PerformanceObserver((list) => {
				for (const entry of list.getEntries()) {
					if (!entry.hadRecentInput) window.__clsEntries.push(entry);
				}
			}).observe({ type: 'layout-shift', buffered: true });
		} catch (e) {}
	});

	await page.goto('https://www.google.com/search?q=google&hl=en&gl=us');
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(2000);

	const result = await page.evaluate(() => {
		const entries = window.__clsEntries || [];
		const total = entries.reduce((sum, e) => sum + e.value, 0);
		return {
			total,
			entries: entries.map((e) => ({
				value: e.value,
				time: e.startTime,
				sources: (e.sources || []).map((s) => ({
					node: s.node ? s.node.id || s.node.className || s.node.tagName : null,
					prevRect: s.previousRect,
					currRect: s.currentRect,
				})),
			})),
		};
	});

	await context.close();
	return result;
}

(async () => {
	console.log('=== Extension DISABLED ===');
	const off = await measure(false);
	console.log('Total CLS:', off.total);
	console.log(JSON.stringify(off.entries, null, 2));

	console.log('\n=== Extension ENABLED ===');
	const on = await measure(true);
	console.log('Total CLS:', on.total);
	console.log(JSON.stringify(on.entries, null, 2));
})();
