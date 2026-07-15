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
const ICON = `data:image/png;base64,${require('fs').readFileSync(path.resolve(__dirname, '../src/icons/icon128.png')).toString('base64')}`;
const FONT = `'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;
const PALETTE = { red: '#cf564a', amber: '#cf953e', teal: '#3fa79e', blue: '#4a72c2' };

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

async function forceThemeIfWrong(page, url, wantDark, maxAttempts = 8) {
	for (let attempt = 0; attempt < maxAttempts && (await isPageDark(page)) !== wantDark; attempt++) {
		console.log(`  [theme] page is ${wantDark ? 'light' : 'dark'}, reloading for ${wantDark ? 'dark' : 'light'} (attempt ${attempt + 1}/${maxAttempts})...`);
		await page.goto(url);
		await page.waitForLoadState('networkidle').catch(() => {});
		await page.waitForTimeout(500);
	}
	if ((await isPageDark(page)) !== wantDark) {
		console.log(`  [theme] still ${wantDark ? 'light' : 'dark'} after retries — proceeding anyway.`);
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

// Wraps the raw captured screenshot in a marketing card: light gradient
// background, benefit headline (**phrase** renders as a gradient accent),
// small icon + feature label, screenshot in a shadowed white card. Scales
// off a 1280-wide reference layout so 640-wide output stays proportional.
function marketingCardHtml({ width, height, headline, featureLabel, screenshotDataUri }) {
	const scale = width / 1280;
	const px = (n) => Math.round(n * scale);
	const headlineHtml = headline.replace(
		/\*\*(.+?)\*\*/,
		(_, phrase) => `<span style="background:linear-gradient(90deg, ${PALETTE.teal}, ${PALETTE.blue});-webkit-background-clip:text;background-clip:text;color:transparent;">${phrase}</span>`
	);
	return `<!doctype html><html><head><style>
		*{margin:0;padding:0;box-sizing:border-box;}
		body{width:${width}px;height:${height}px;font-family:${FONT};overflow:hidden;position:relative;
			background:linear-gradient(135deg, #ffffff 0%, #eef7f6 45%, #eef1fb 100%);}
	</style></head><body>
		<div style="position:absolute;left:-10%;top:-20%;width:${px(500)}px;height:${px(500)}px;border-radius:50%;
			background:radial-gradient(circle, rgba(63,167,158,0.16) 0%, rgba(63,167,158,0) 70%);"></div>
		<div style="position:absolute;right:-10%;bottom:-25%;width:${px(500)}px;height:${px(500)}px;border-radius:50%;
			background:radial-gradient(circle, rgba(207,149,62,0.14) 0%, rgba(207,149,62,0) 70%);"></div>
		<div style="position:relative;height:100%;display:flex;flex-direction:column;align-items:center;padding:${px(36)}px ${px(60)}px ${px(30)}px;">
			<div style="font-size:${px(34)}px;font-weight:800;color:#1a1f26;text-align:center;line-height:1.22;letter-spacing:-0.3px;max-width:${px(1000)}px;">${headlineHtml}</div>
			<div style="display:flex;align-items:center;gap:${px(10)}px;margin-top:${px(14)}px;margin-bottom:${px(22)}px;">
				<img src="${ICON}" style="width:${px(22)}px;height:${px(22)}px;border-radius:${px(5)}px;">
				<div style="font-size:${px(16)}px;font-weight:600;color:#5b6270;letter-spacing:0.3px;">${featureLabel}</div>
			</div>
			<div style="flex:1;width:100%;display:flex;align-items:center;justify-content:center;min-height:0;">
				<img src="${screenshotDataUri}" style="max-width:100%;max-height:100%;object-fit:contain;
					border-radius:${px(14)}px;box-shadow:0 ${px(20)}px ${px(45)}px rgba(30,40,50,0.16);border:1px solid #e4e5e2;">
			</div>
		</div>
	</body></html>`;
}

const SCREENSHOTS = [
	{
		name: 'img1_ranges.png',
		query: 'chrome extensions',
		// Google's layout has a fixed max-width, so a wider viewport just adds
		// empty space rather than zooming. Real zoom: capture at 2x pixel
		// density, then crop+resize down for a sharp result.
		captureViewport: { width: 1280, height: 800 },
		deviceScaleFactor: 2,
		// tbs=qdr URL param is unreliable on this profile — force the chip's
		// selected look via its own CSS classes instead.
		forceSelectChipId: 'qdr_m6',
		// Crop MUST match outputSize's aspect ratio (1280/800 = 1.6). The
		// resize below uses sharp's default fit:'cover', which crops the top
		// & bottom to force the target aspect — an off-ratio crop silently
		// slices the top of the page off. width = height * 1.6.
		crop: { left: 0, top: 0, width: 1656, height: 1035 },
		outputSize: { width: 1280, height: 800 },
		arrowTarget: '#qdr_m6',
		arrowGap: 4,
		arrow: { height: 150, color: '#4CAF50', strokeColor: '#8fbf5f' },
		headline: "Ranges Google's own filter **doesn't have**",
		featureLabel: '3 months · 6 months · 2 years · 5 years',
		// Plain shot (no card) for generate-banners.js to embed.
		plainCopyPath: '../assets/banner-shot.png',
	},
	{
		name: 'img2_verbatim.png',
		query: 'chrome extensions',
		captureViewport: { width: 1280, height: 800 },
		deviceScaleFactor: 2,
		forceSelectVerbatim: true,
		crop: { left: 0, top: 0, width: 1656, height: 1035 },
		outputSize: { width: 1280, height: 800 },
		arrowTarget: '.time-li-verbatim',
		arrowGap: 4,
		arrow: { height: 180, color: '#4CAF50', strokeColor: '#8fbf5f' },
		headline: 'Exact-match search, **one click away**',
		featureLabel: 'Verbatim toggle',
	},
	{
		name: 'img3_rangepicker.png',
		query: 'reddit',
		captureViewport: { width: 1280, height: 800 },
		deviceScaleFactor: 2,
		// Show the Range button in its "custom range applied" state, labelled
		// with the picked dates. A real cdr URL returns no results on this
		// profile (same as qdr), so set the label directly — same approach as
		// forceSelectChipId.
		interact: async (page) => {
			await page.waitForSelector('.time-li-range h3');
			await page.evaluate(() => {
				// A custom range is active, so clear the default "Any time" chip.
				document.getElementById('qdr_')?.classList.remove('time-li-sel');
				document.querySelector('#qdr_ h3')?.classList.remove('time-h3-sel');
				// Show the picked range as the Range button's active label.
				const label = document.querySelector('.time-li-range h3');
				label.textContent = '2026-06-01 – 2026-06-30';
				label.classList.add('time-h3-sel');
			});
			await page.waitForTimeout(200);
		},
		crop: { left: 0, top: 0, width: 1656, height: 1035 },
		outputSize: { width: 1280, height: 800 },
		arrowTarget: '.time-li-range',
		arrowGap: 4,
		arrow: { height: 150, color: '#4CAF50', strokeColor: '#8fbf5f' },
		headline: 'Plus a **real custom date-range picker**',
		featureLabel: 'Custom Range',
	},
	{
		name: 'img4_darkmode.png',
		query: 'google',
		captureViewport: { width: 1280, height: 800 },
		deviceScaleFactor: 2,
		theme: 'dark',
		forceSelectChipId: 'qdr_m',
		crop: { left: 0, top: 0, width: 1656, height: 1035 },
		outputSize: { width: 1280, height: 800 },
		arrowTarget: '#qdr_m',
		arrowGap: 4,
		arrow: { height: 150, color: '#4CAF50', strokeColor: '#8fbf5f' },
		headline: "Matches Google's dark theme **automatically**",
		featureLabel: 'Light & dark, seamlessly',
	},
	{
		name: 'img5_calendar.png',
		query: 'chrome extensions',
		captureViewport: { width: 1280, height: 800 },
		deviceScaleFactor: 2,
		forceSelectCalendarKey: 'quarter',
		crop: { left: 0, top: 0, width: 1656, height: 1035 },
		outputSize: { width: 1280, height: 800 },
		arrowTarget: '[data-preset="quarter"]',
		arrowGap: 4,
		arrow: { height: 150, color: '#4CAF50', strokeColor: '#8fbf5f' },
		headline: 'Real calendar ranges, **not just rolling windows**',
		featureLabel: 'This week · This month · This quarter · This year',
	},
];

(async () => {
	const filter = process.argv[2];
	const toRun = filter ? SCREENSHOTS.filter((s) => s.name.includes(filter)) : SCREENSHOTS;
	if (toRun.length === 0) {
		console.error(`No screenshot config matches "${filter}".`);
		process.exit(1);
	}

	// Separate standalone browser for compositing the marketing card — the
	// live-capture context above is closed per spec (fresh profile state),
	// but the card render is just static HTML and can share one instance.
	const composeBrowser = await chromium.launch();

	for (const spec of toRun) {
		const colorScheme = spec.theme === 'dark' ? 'dark' : 'light';
		const context = await chromium.launchPersistentContext(PROFILE_DIR, {
			headless: false,
			viewport: spec.captureViewport,
			deviceScaleFactor: spec.deviceScaleFactor || 1,
			colorScheme,
			args: [`--disable-extensions-except=${SRC_DIR}`, `--load-extension=${SRC_DIR}`],
		});
		const page = context.pages()[0] ?? (await context.newPage());
		await page.emulateMedia({ colorScheme });

		const url = `https://www.google.com/search?q=${encodeURIComponent(spec.query)}&hl=en&gl=us`;
		await page.goto(url);
		await waitForHumanIfCaptcha(page);
		await dismissConsentIfPresent(page);
		await page.waitForLoadState('networkidle').catch(() => {});
		await page.waitForTimeout(700);
		await waitForHumanIfCaptcha(page);
		await dismissConsentIfPresent(page);
		await forceThemeIfWrong(page, url, spec.theme === 'dark');
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
			await page.evaluate(() => {
				// On a real li:1 URL "Any time" isn't lit, so clear the default.
				document.getElementById('qdr_')?.classList.remove('time-li-sel');
				document.querySelector('#qdr_ h3')?.classList.remove('time-h3-sel');
				// Verbatim's id alternates between li_/li_1, unlike the numeric
				// chips' stable ids — select it by class instead.
				const verbatimLi = document.querySelector('.time-li-verbatim');
				if (verbatimLi) {
					verbatimLi.classList.add('time-li-sel');
					verbatimLi.querySelector('h3')?.classList.add('time-h3-sel');
				}
			});
			await page.waitForTimeout(200);
		}

		if (spec.forceSelectCalendarKey) {
			await page.evaluate((key) => {
				// On a real cdr URL "Any time" isn't lit, so clear the default.
				document.getElementById('qdr_')?.classList.remove('time-li-sel');
				document.querySelector('#qdr_ h3')?.classList.remove('time-h3-sel');
				const li = document.querySelector(`[data-preset="${key}"]`);
				if (li) {
					li.classList.add('time-li-sel');
					li.querySelector('h3')?.classList.add('time-h3-sel');
				}
			}, spec.forceSelectCalendarKey);
			await page.waitForTimeout(200);
		}

		// Consent dismissal / chip clicks / opening the Range popup can all
		// leave the page scrolled slightly from 0 — force it back before
		// measuring or capturing, or every shot ends up cut off at the top.
		await page.evaluate(() => window.scrollTo(0, 0));
		await page.waitForTimeout(100);

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

		// Save the plain screenshot+arrow (before the marketing-card wrap) for
		// the banner to embed — a banner has its own headline, so it wants the
		// bare product shot, not the full store-listing card.
		if (spec.plainCopyPath) {
			await sharp(outBuf).toFile(path.resolve(__dirname, spec.plainCopyPath));
			console.log(`  [plain] wrote ${spec.plainCopyPath}`);
		}

		if (spec.headline) {
			const cardHtml = marketingCardHtml({
				width: spec.outputSize.width,
				height: spec.outputSize.height,
				headline: spec.headline,
				featureLabel: spec.featureLabel,
				screenshotDataUri: `data:image/png;base64,${outBuf.toString('base64')}`,
			});
			const composePage = await composeBrowser.newPage({
				viewport: { width: spec.outputSize.width, height: spec.outputSize.height },
				deviceScaleFactor: 2,
			});
			await composePage.setContent(cardHtml);
			await composePage.waitForTimeout(150);
			const cardRaw = await composePage.screenshot();
			await composePage.close();
			outBuf = await sharp(cardRaw).resize(spec.outputSize.width, spec.outputSize.height).png().toBuffer();
		}

		const outPath = path.join(OUT_DIR, spec.name);
		await sharp(outBuf).toFile(outPath);
		console.log(`Wrote ${outPath}`);
	}

	await composeBrowser.close();
})();
