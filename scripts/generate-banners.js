// Generates the Chrome Web Store promo banners (assets/banner1.png,
// assets/banner3.png) from the icon + a real product screenshot.
// Run: node scripts/generate-banners.js
const { chromium } = require('playwright');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const OUT_DIR = path.resolve(__dirname, '../assets');
const ICON = `data:image/png;base64,${fs.readFileSync(path.resolve(__dirname, '../src/icons/icon128.png')).toString('base64')}`;
const SHOT = `data:image/png;base64,${fs.readFileSync(path.resolve(__dirname, '../screenshots/img.png')).toString('base64')}`;

const HEADLINE = 'Every date range, one click away';
const TAGLINE = "6 months, 2 years, 5 years — and a custom date picker. Ranges Google's own filter doesn't have.";
const FONT = `'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;
const PALETTE = { red: '#cf564a', amber: '#cf953e', teal: '#3fa79e', blue: '#4a72c2' };
const BASE = '#232a35';

// Fine turbulence grain — a flat dark fill reads as empty/flat.
const GRAIN = `<svg style="position:absolute;inset:0;width:100%;height:100%;z-index:1;opacity:0.05;">
	<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/></filter>
	<rect width="100%" height="100%" filter="url(#n)"/>
</svg>`;

const dashMarks = (size) =>
	Object.values(PALETTE).map((c) => `<div style="width:${size * 3.7}px;height:${size}px;border-radius:${size / 2}px;background:${c};"></div>`).join('');

function marqueeHtml() {
	return `<!doctype html><html><head><style>
		*{margin:0;padding:0;box-sizing:border-box;}
		body{width:1400px;height:560px;font-family:${FONT};overflow:hidden;position:relative;background:${BASE};}
	</style></head><body>
		<div style="position:absolute;inset:0;box-shadow:inset 0 0 220px 40px rgba(0,0,0,0.45);z-index:1;"></div>
		<div style="position:absolute;right:-8%;top:50%;transform:translateY(-50%);width:1000px;height:1000px;border-radius:50%;
			background:radial-gradient(circle, rgba(63,167,158,0.26) 0%, rgba(74,114,194,0.14) 40%, rgba(74,114,194,0) 68%);z-index:1;"></div>
		${GRAIN}
		<div style="display:flex;height:100%;align-items:center;padding:0 70px;gap:56px;position:relative;z-index:2;">
			<div style="flex:0 0 460px;">
				<div style="display:flex;align-items:center;gap:16px;margin-bottom:22px;">
					<img src="${ICON}" style="width:56px;height:56px;border-radius:13px;">
					<div style="font-size:22px;font-weight:700;color:#8a92a0;letter-spacing:1.8px;text-transform:uppercase;">Search Date Bar</div>
				</div>
				<div style="display:flex;gap:6px;margin-bottom:20px;">${dashMarks(6)}</div>
				<div style="font-size:44px;font-weight:800;color:#f5f6f7;line-height:1.12;letter-spacing:-0.5px;">${HEADLINE}</div>
				<div style="font-size:23px;font-weight:400;color:#aab2bd;line-height:1.5;margin-top:22px;">${TAGLINE}</div>
			</div>
			<div style="flex:1;height:420px;border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.4);">
				<img src="${SHOT}" style="width:100%;height:100%;object-fit:cover;object-position:top;">
			</div>
		</div>
	</body></html>`;
}

// Stacked layout, tagline dropped — 440x280 is too narrow for the marquee's side-by-side.
function smallTileHtml() {
	return `<!doctype html><html><head><style>
		*{margin:0;padding:0;box-sizing:border-box;}
		body{width:440px;height:280px;font-family:${FONT};overflow:hidden;position:relative;background:${BASE};}
	</style></head><body>
		<div style="position:absolute;inset:0;box-shadow:inset 0 0 90px 16px rgba(0,0,0,0.45);z-index:1;"></div>
		<div style="position:absolute;right:-20%;top:50%;transform:translateY(-50%);width:420px;height:420px;border-radius:50%;
			background:radial-gradient(circle, rgba(63,167,158,0.26) 0%, rgba(74,114,194,0.14) 40%, rgba(74,114,194,0) 68%);z-index:1;"></div>
		${GRAIN}
		<div style="position:relative;z-index:2;padding:16px 20px 0;">
			<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
				<img src="${ICON}" style="width:28px;height:28px;border-radius:7px;">
				<div style="font-size:11px;font-weight:700;color:#8a92a0;letter-spacing:1.2px;text-transform:uppercase;">Search Date Bar</div>
			</div>
			<div style="font-size:20px;font-weight:800;color:#f5f6f7;line-height:1.16;letter-spacing:-0.3px;">Every date range,<br>one click away</div>
		</div>
		<div style="position:absolute;left:20px;right:20px;bottom:18px;height:132px;border-radius:10px;overflow:hidden;
			box-shadow:0 10px 26px rgba(0,0,0,0.4);z-index:2;">
			<img src="${SHOT}" style="width:100%;height:100%;object-fit:cover;object-position:top left;">
		</div>
	</body></html>`;
}

const BANNERS = [
	{ name: 'banner1.png', width: 1400, height: 560, html: marqueeHtml },
	{ name: 'banner3.png', width: 440, height: 280, html: smallTileHtml },
];

(async () => {
	const browser = await chromium.launch();
	// Supersample at 2x, then resize down to the exact target — sharper
	// text/edges than capturing at 1x, and guarantees exact CWS dimensions.
	for (const banner of BANNERS) {
		const page = await browser.newPage({ viewport: { width: banner.width, height: banner.height }, deviceScaleFactor: 2 });
		await page.setContent(banner.html());
		await page.waitForTimeout(150);
		const raw = await page.screenshot();
		await page.close();
		const outPath = path.join(OUT_DIR, banner.name);
		await sharp(raw).resize(banner.width, banner.height).png().toFile(outPath);
		console.log(`Wrote ${outPath}`);
	}
	await browser.close();
})();
