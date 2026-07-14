// Generates the Chrome Web Store screenshot/promo images in screenshots/.
// Run: node scripts/generate-screenshots.js [filename-substring]
const { chromium } = require('playwright');
const sharp = require('sharp');
const path = require('path');
const os = require('os');
const {
	dismissConsentIfPresent,
	waitForHumanIfCaptcha,
} = require('../tests/fixtures/extension');

const PROFILE_DIR = path.join(os.tmpdir(), 'sdb-fresh-profile');
const SRC_DIR = path.resolve(__dirname, '../src');
const OUT_DIR = path.resolve(__dirname, '../screenshots');

// Google's dark/light rendering comes from a stored per-profile preference,
// not prefers-color-scheme, and is inconsistent across identical runs on
// this reused profile — retrying a reload is more reliable than automating
// the settings menu, and avoids clearing cookies (which re-triggers a CAPTCHA).
async function isPageDark(page) {
	return page.evaluate(() => {
		const bg = getComputedStyle(document.body).backgroundColor;
		const rgb = bg.match(/\d+/g);
		if (!rgb) return false;
		return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 < 0.5;
	});
}

async function forceLightThemeIfDark(page, url) {
	for (let attempt = 0; attempt < 3 && (await isPageDark(page)); attempt++) {
		console.log(`  [theme] page is dark, reloading (attempt ${attempt + 1}/3)...`);
		await page.goto(url);
		await page.waitForLoadState('networkidle').catch(() => {});
		await page.waitForTimeout(500);
	}
	if (await isPageDark(page)) {
		console.log('  [theme] still dark after retries — proceeding anyway.');
	}
}

// Google's real logo PNG, used to replace holiday/event "Doodle" logos so
// screenshots don't get dated.
const GOOGLE_LOGO_URL = 'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png';

// Doodles aren't reliably a plain <img> (can be SVG/canvas/animated div), so
// target the logo's stable wrapper instead — the homepage link is always
// there regardless of what's inside it.
async function replaceDoodleLogoIfPresent(page) {
	const replaced = await page.evaluate((logoUrl) => {
		const link = document.querySelector('a[href*="webhp"]');
		if (!link) return false;
		const rect = link.getBoundingClientRect();
		// Bail if this link wraps something much bigger than the real logo.
		if (rect.top > 150 || rect.left > 300 || rect.width < 20 || rect.width > 300 || rect.height > 150) {
			return false;
		}

		const img = document.createElement('img');
		img.src = logoUrl;
		img.alt = 'Google';
		img.style.height = '31px';
		img.style.width = 'auto';
		link.replaceChildren(img);
		return true;
	}, GOOGLE_LOGO_URL);
	if (replaced) {
		await page.waitForTimeout(400);
		console.log('  [logo] replaced logo-position element with the real Google logo image.');
	}
	return replaced;
}

// Maps a DOM element's real rendered position to output-image pixels, so
// arrow callouts land exactly instead of by guesswork. boundingBox() is in
// CSS pixels relative to the viewport; screenshots are physical pixels
// (x deviceScaleFactor), then get cropped and resized to the output size.
async function getArrowTipInOutputSpace(page, selector, spec) {
	const box = await page.locator(selector).boundingBox();
	if (!box) throw new Error(`arrowTarget selector "${selector}" matched no element`);

	const dsf = spec.deviceScaleFactor || 1;
	const physCenterX = (box.x + box.width / 2) * dsf;
	const physBottomY = (box.y + box.height) * dsf;

	const cropLeft = spec.crop ? spec.crop.left : 0;
	const cropTop = spec.crop ? spec.crop.top : 0;
	const cropWidth = spec.crop ? spec.crop.width : null;
	const cropHeight = spec.crop ? spec.crop.height : null;

	const scaleX = spec.outputSize && cropWidth ? spec.outputSize.width / cropWidth : 1;
	const scaleY = spec.outputSize && cropHeight ? spec.outputSize.height / cropHeight : 1;

	return {
		x: (physCenterX - cropLeft) * scaleX,
		y: (physBottomY - cropTop) * scaleY,
	};
}

function arrowSvg({ height, color, strokeColor }) {
	const w = height * 0.42;
	const headH = height * 0.34;
	const shaftW = w * 0.34;
	return `<svg width="${w * 2}" height="${height + 10}" xmlns="http://www.w3.org/2000/svg">
		<defs><filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
			<feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.35"/>
		</filter></defs>
		<g filter="url(#shadow)">
			<path d="M ${w} 4 L ${w + w / 2} ${headH} L ${w + shaftW / 2} ${headH} L ${w + shaftW / 2} ${height} L ${w - shaftW / 2} ${height} L ${w - shaftW / 2} ${headH} L ${w - w / 2} ${headH} Z"
				fill="${color}" stroke="${strokeColor || color}" stroke-width="2"/>
		</g>
	</svg>`;
}

const SCREENSHOTS = [
	{
		name: 'img.png',
		query: 'chrome extensions',
		// Google's layout has a fixed max-width, so a wider viewport just adds
		// empty space rather than zooming. Real zoom: capture at 2x pixel
		// density, then crop+resize down for a sharp result.
		captureViewport: { width: 1280, height: 800 },
		deviceScaleFactor: 2,
		// tbs=qdr URL param is unreliable on this profile — force the chip's
		// selected look via its own CSS classes instead.
		forceSelectChipId: 'qdr_m6',
		crop: { left: 0, top: 0, width: 1550, height: 969 },
		outputSize: { width: 1280, height: 800 },
		arrowTarget: '#qdr_m6',
		arrowGap: 12,
		arrow: { height: 190, color: '#4CAF50', strokeColor: '#8fbf5f' },
	},
	{
		name: 'img2.png',
		query: 'chrome extensions',
		captureViewport: { width: 1280, height: 800 },
		deviceScaleFactor: 2,
		forceSelectVerbatim: true,
		crop: { left: 0, top: 0, width: 1550, height: 969 },
		outputSize: { width: 1280, height: 800 },
		arrowTarget: '.time-li-verbatim',
		arrowGap: 12,
		arrow: { height: 220, color: '#4CAF50', strokeColor: '#8fbf5f' },
	},
	{
		name: 'img1_640.png',
		query: 'google',
		captureViewport: { width: 1280, height: 800 },
		deviceScaleFactor: 2,
		crop: { left: 0, top: 0, width: 1300, height: 812 },
		outputSize: { width: 640, height: 400 },
		arrowTarget: '#qdr_m',
		arrowGap: 10,
		arrow: { height: 90, color: '#4CAF50', strokeColor: '#8fbf5f' },
	},
	{
		name: 'img3_640.png',
		query: 'reddit',
		captureViewport: { width: 1280, height: 800 },
		deviceScaleFactor: 2,
		// Original pointed at "By Date", since removed — "Range" is its
		// real current replacement.
		forceSelectChipId: 'qdr_w',
		crop: { left: 0, top: 0, width: 1300, height: 812 },
		outputSize: { width: 640, height: 400 },
		arrowTarget: '.time-li-range',
		arrowGap: 10,
		arrow: { height: 90, color: '#4CAF50', strokeColor: '#8fbf5f' },
	},
	{
		name: 'img3_small.png',
		query: 'reddit',
		// img3_640.png already shows the Range chip — show the popup open
		// instead of repeating that shot at a smaller size.
		captureViewport: { width: 1280, height: 800 },
		deviceScaleFactor: 2,
		interact: async (page) => {
			await page.click('.time-li-range');
			await page.waitForSelector('#custom-range-popup', { state: 'visible' });
			await page.fill('#custom-start', '2026-06-01');
			await page.fill('#custom-end', '2026-06-30');
			await page.waitForTimeout(200);
		},
		crop: { left: 0, top: 0, width: 1350, height: 859 },
		outputSize: { width: 440, height: 280 },
	},
	{
		name: 'img_small.png',
		query: 'chrome extensions',
		captureViewport: { width: 1280, height: 800 },
		deviceScaleFactor: 2,
		forceSelectChipId: 'qdr_m6',
		arrowTarget: '#qdr_m6',
		arrowGap: 8,
		arrow: { height: 70, color: '#4CAF50', strokeColor: '#8fbf5f' },
		crop: { left: 0, top: 0, width: 1100, height: 700 },
		outputSize: { width: 440, height: 280 },
	},
];

(async () => {
	const filter = process.argv[2];
	const toRun = filter ? SCREENSHOTS.filter((s) => s.name.includes(filter)) : SCREENSHOTS;
	if (toRun.length === 0) {
		console.error(`No screenshot config matches "${filter}".`);
		process.exit(1);
	}

	for (const spec of toRun) {
		const context = await chromium.launchPersistentContext(PROFILE_DIR, {
			headless: false,
			viewport: spec.captureViewport,
			deviceScaleFactor: spec.deviceScaleFactor || 1,
			colorScheme: 'light',
			args: [`--disable-extensions-except=${SRC_DIR}`, `--load-extension=${SRC_DIR}`],
		});
		const page = context.pages()[0] ?? (await context.newPage());
		await page.emulateMedia({ colorScheme: 'light' });

		const url = `https://www.google.com/search?q=${encodeURIComponent(spec.query)}&hl=en&gl=us`;
		await page.goto(url);
		await waitForHumanIfCaptcha(page);
		await dismissConsentIfPresent(page);
		await page.waitForLoadState('networkidle').catch(() => {});
		await page.waitForTimeout(700);
		await waitForHumanIfCaptcha(page);
		await dismissConsentIfPresent(page);
		await forceLightThemeIfDark(page, url);
		await replaceDoodleLogoIfPresent(page);

		if (spec.interact) {
			await spec.interact(page);
		}

		if (spec.forceSelectChipId) {
			await page.evaluate((chipId) => {
				const defaultLi = document.getElementById('qdr_');
				if (defaultLi) {
					defaultLi.classList.remove('time-li-sel');
					defaultLi.querySelector('h3')?.classList.remove('time-h3-sel');
				}
				const targetLi = document.getElementById(chipId);
				if (targetLi) {
					targetLi.classList.add('time-li-sel');
					targetLi.querySelector('h3')?.classList.add('time-h3-sel');
				}
			}, spec.forceSelectChipId);
			await page.waitForTimeout(200);
		}

		if (spec.forceSelectVerbatim) {
			// Verbatim's id alternates between li_/li_1, unlike the numeric
			// chips' stable ids — select it by class instead.
			await page.evaluate(() => {
				const verbatimLi = document.querySelector('.time-li-verbatim');
				if (verbatimLi) {
					verbatimLi.classList.add('time-li-sel');
					verbatimLi.querySelector('h3')?.classList.add('time-h3-sel');
				}
			});
			await page.waitForTimeout(200);
		}

		// Measured before the context closes — see getArrowTipInOutputSpace.
		const arrowTip = spec.arrowTarget ? await getArrowTipInOutputSpace(page, spec.arrowTarget, spec) : null;

		const rawBuf = await page.screenshot();
		await context.close();

		let pipeline = sharp(rawBuf);
		if (spec.crop) pipeline = pipeline.extract(spec.crop);
		if (spec.outputSize) pipeline = pipeline.resize(spec.outputSize.width, spec.outputSize.height);
		let outBuf = await pipeline.png().toBuffer();

		if (spec.arrow && arrowTip) {
			const gap = spec.arrowGap || 10;
			const arrow = Buffer.from(
				arrowSvg({ height: spec.arrow.height, color: spec.arrow.color, strokeColor: spec.arrow.strokeColor })
			);
			const arrowMeta = await sharp(arrow).metadata();
			outBuf = await sharp(outBuf)
				.composite([{
					input: arrow,
					left: Math.round(arrowTip.x - arrowMeta.width / 2),
					top: Math.round(arrowTip.y + gap),
				}])
				.png()
				.toBuffer();
		}

		const outPath = path.join(OUT_DIR, spec.name);
		await sharp(outBuf).toFile(outPath);
		console.log(`Wrote ${outPath}`);
	}
})();
