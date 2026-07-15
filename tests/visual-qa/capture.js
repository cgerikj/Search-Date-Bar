// Visual QA capture tool — see README.md in this directory.
// Run: node tests/visual-qa/capture.js
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require('@playwright/test');
const { dismissConsentIfPresent, waitForHumanIfCaptcha } = require('../fixtures/extension');

const PROFILE_DIR = path.join(os.tmpdir(), 'sdb-fresh-profile');
const SRC_DIR = path.resolve(__dirname, '../../src');
// Not test-results/ — Playwright wipes that directory on every test run.
const OUT_DIR = path.resolve(__dirname, 'output');

const SCENARIOS = [
	// --- Page types / native widgets ---
	{ group: 'Page types', name: '01-google-baseline', query: 'google' },
	{ group: 'Page types', name: '02-reddit', query: 'reddit' },
	{ group: 'Page types', name: '03-weather-widget', query: 'weather' },
	{ group: 'Page types', name: '04-people-also-ask', query: 'how to boil an egg' },
	{ group: 'Page types', name: '05-sparse-results', query: 'asdkfjapowjfxyzqqz11' },
	{ group: 'Page types', name: '06-dictionary-widget', query: 'define serendipity' },
	{ group: 'Page types', name: '07-calculator-widget', query: '1+1' },
	{ group: 'Page types', name: '08-time-widget', query: 'time in tokyo' },

	// --- Extension states ---
	{ group: 'Extension states', name: '09-active-1D-filter', query: 'google', params: '&tbs=qdr:d' },
	{
		group: 'Extension states',
		name: '09b-custom-range-modal-open',
		query: 'google',
		interact: async (page) => {
			await page.getByText('Range', { exact: true }).click();
			await page.waitForTimeout(400);
		},
	},
	{
		group: 'Extension states',
		name: '10-custom-range-active',
		query: 'google',
		params: `&tbs=${encodeURIComponent('cdr:1,cd_min:1/1/2024,cd_max:6/15/2024')}`,
	},
	{ group: 'Extension states', name: '11-verbatim-active', query: 'google', params: '&tbs=li:1' },

	// --- Viewport widths (960 = half a 1080p screen, 768 = tablet, 600 = narrow) ---
	{ group: 'Viewport widths', name: '12a-width-1280-baseline', query: 'google', viewport: { width: 1280, height: 900 } },
	{ group: 'Viewport widths', name: '12b-width-960-half-1080p', query: 'google', viewport: { width: 960, height: 900 } },
	{ group: 'Viewport widths', name: '12c-width-768', query: 'google', viewport: { width: 768, height: 900 } },
	{ group: 'Viewport widths', name: '12d-width-600', query: 'google', viewport: { width: 600, height: 900 } },

	// --- Native Tools menu interaction (nested submenus) ---
	{
		group: 'Native Tools menu',
		name: '13-tools-open',
		query: 'google',
		interact: async (page) => {
			await page.locator('#hdtb-tls').click();
			await page.waitForTimeout(400);
		},
	},
	{
		group: 'Native Tools menu',
		name: '14-tools-anytime-submenu',
		query: 'google',
		interact: async (page) => {
			await page.locator('#hdtb-tls').click();
			await page.waitForTimeout(400);
			await page.getByRole('button', { name: 'Any time' }).first().hover();
			await page.waitForTimeout(500);
		},
	},
	{
		group: 'Native Tools menu',
		name: '15-tools-allresults-submenu',
		query: 'google',
		interact: async (page) => {
			await page.locator('#hdtb-tls').click();
			await page.waitForTimeout(400);
			await page.getByRole('button', { name: 'All results' }).first().hover();
			await page.waitForTimeout(500);
		},
	},

	// --- Locales (hl/gl), each paired with a different query type ---
	{ group: 'Locales', name: '16-locale-swedish-weather', query: 'väder', hl: 'sv', gl: 'se' },
	{ group: 'Locales', name: '17-locale-german-calculator', query: '2+2', hl: 'de', gl: 'de' },
	{
		group: 'Locales',
		name: '18-locale-uk-english-dictionary',
		query: 'define happiness',
		hl: 'en',
		gl: 'gb',
	},
	{ group: 'Locales', name: '19-locale-japanese-time', query: 'time in london', hl: 'ja', gl: 'jp' },
	{ group: 'Locales', name: '20-locale-arabic-rtl-baseline', query: 'google', hl: 'ar', gl: 'sa' },
	{ group: 'Locales', name: '21-locale-french-reddit', query: 'reddit', hl: 'fr', gl: 'fr' },
	{
		group: 'Locales',
		name: '22-locale-brazilian-portuguese-howto',
		query: 'how to make coffee',
		hl: 'pt-BR',
		gl: 'br',
	},
	{ group: 'Locales', name: '23-locale-hindi-programming', query: 'python', hl: 'hi', gl: 'in' },

	// --- Dark mode — colorScheme: 'dark' genuinely puts Google itself into
	// its own dark theme, not just our CSS's media query.
	{ group: 'Dark mode', name: '24-dark-baseline', query: 'google', colorScheme: 'dark' },
	{
		group: 'Dark mode',
		name: '25-dark-custom-range-modal-open',
		query: 'google',
		colorScheme: 'dark',
		interact: async (page) => {
			await page.getByText('Range', { exact: true }).click();
			await page.waitForTimeout(400);
		},
	},
	{
		group: 'Dark mode',
		name: '26-dark-tools-open',
		query: 'google',
		colorScheme: 'dark',
		interact: async (page) => {
			await page.locator('#hdtb-tls').click();
			await page.waitForTimeout(400);
		},
	},
];

async function runScenario(scenario) {
	const context = await chromium.launchPersistentContext(PROFILE_DIR, {
		headless: false,
		viewport: scenario.viewport || { width: 1280, height: 900 },
		colorScheme: scenario.colorScheme || 'light',
		args: [`--disable-extensions-except=${SRC_DIR}`, `--load-extension=${SRC_DIR}`],
	});
	const page = context.pages()[0] ?? (await context.newPage());
	try {
		const hl = scenario.hl || 'en';
		const gl = scenario.gl || 'us';
		const params = scenario.params || '';
		await page.goto(
			`https://www.google.com/search?q=${encodeURIComponent(scenario.query)}&hl=${hl}&gl=${gl}${params}`
		);
		await waitForHumanIfCaptcha(page);
		await dismissConsentIfPresent(page);
		await page.waitForLoadState('networkidle').catch(() => {});
		await page.waitForTimeout(700);
		await waitForHumanIfCaptcha(page);
		await dismissConsentIfPresent(page);

		if (scenario.interact) {
			await scenario.interact(page);
		}

		fs.mkdirSync(OUT_DIR, { recursive: true });
		await page.screenshot({ path: path.join(OUT_DIR, `${scenario.name}.png`) });
		console.log(`OK: ${scenario.name}`);
	} catch (err) {
		console.log(`FAILED: ${scenario.name} — ${err.message}`);
	}
	await context.close();
}

// Optional substring filter, e.g. `node capture.js width`.
const FILTER = process.argv[2];
const toRun = FILTER ? SCENARIOS.filter((s) => s.name.includes(FILTER)) : SCENARIOS;

(async () => {
	for (const scenario of toRun) {
		await runScenario(scenario);
		await new Promise((r) => setTimeout(r, 1200));
	}

	// gallery.js reads this for group names; merge so a filtered run doesn't drop other entries.
	fs.mkdirSync(OUT_DIR, { recursive: true });
	const manifestPath = path.join(OUT_DIR, 'manifest.json');
	const existing = fs.existsSync(manifestPath)
		? JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
		: [];
	const byName = new Map(existing.map((m) => [m.name, m]));
	for (const s of SCENARIOS) byName.set(s.name, { name: s.name, group: s.group });
	fs.writeFileSync(manifestPath, JSON.stringify([...byName.values()], null, 2));

	console.log(`\nDone. ${toRun.length} scenario(s) captured to ${OUT_DIR}`);
	console.log('Run `node tests/visual-qa/gallery.js` to build the HTML gallery.');
})();
