// Generates src/icons/icon{16,32,48,128}.png from the HDMY quadrant design.
// Run: node scripts/generate-icon.js
//
// Design notes (so future changes don't silently reintroduce fixed bugs):
// - min-height:0/min-width:0/overflow:hidden on .quad is required. CSS grid
//   items default to min-height:auto, which lets the 48px text override the
//   1fr/1fr equal split and pushes the divider off-center (measured up to a
//   42px offset without this fix).
// - The divider must be a visible color (not transparent) — a fully
//   transparent divider on a solid quadrant background loses the grid-line
//   definition that keeps the icon legible at 16px.
// - Padding follows Chrome's own spec: 96x96 actual artwork centered in the
//   128x128 canvas, 16px transparent margin per side.
// - Downscaling uses the 'linear' kernel — empirically the best tradeoff
//   between 'nearest' (jagged) and 'lanczos3'/cubic/mitchell (too soft) for
//   this flat-color, high-contrast design.
const { chromium } = require('playwright');
const sharp = require('sharp');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, '../src/icons');
const SIZES = [128, 48, 32, 16];

const PALETTE = ['#cf564a', '#cf953e', '#3fa79e', '#4a72c2']; // H, D, M, Y quadrants
const DIVIDER_COLOR = '#ffffff';
const DIVIDER_WIDTH = 6;
const CORNER_RADIUS = 28;
const LETTER_COLOR = '#ffffff';
const FONT_SIZE = 48;

function iconHtml() {
	return `<!doctype html><html><head><style>
		*{margin:0;padding:0;box-sizing:border-box;}
		html,body{width:128px;height:128px;background:transparent;}
		.icon{width:128px;height:128px;border-radius:${CORNER_RADIUS}px;overflow:hidden;
			display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;
			gap:${DIVIDER_WIDTH}px;background:${DIVIDER_COLOR};}
		.quad{display:flex;align-items:center;justify-content:center;font-family:arial,sans-serif;
			font-weight:800;font-size:${FONT_SIZE}px;color:${LETTER_COLOR};
			min-height:0;min-width:0;overflow:hidden;}
	</style></head><body>
		<div class="icon">
			<div class="quad" style="background:${PALETTE[0]}">H</div>
			<div class="quad" style="background:${PALETTE[1]}">D</div>
			<div class="quad" style="background:${PALETTE[2]}">M</div>
			<div class="quad" style="background:${PALETTE[3]}">Y</div>
		</div>
	</body></html>`;
}

(async () => {
	const browser = await chromium.launch();
	const page = await browser.newPage({ viewport: { width: 128, height: 128 }, deviceScaleFactor: 4 });
	await page.setContent(iconHtml());
	await page.waitForTimeout(100);
	const master = await page.screenshot({ omitBackground: true });
	await browser.close();

	// Google's icon spec: 96x96 actual artwork, 16px transparent padding per side.
	const CANVAS = 128, CONTENT = 96, PAD = (CANVAS - CONTENT) / 2;
	const content96 = await sharp(master).resize(CONTENT, CONTENT).png().toBuffer();
	const padded128 = await sharp({
		create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
	})
		.composite([{ input: content96, left: PAD, top: PAD }])
		.png()
		.toBuffer();

	for (const size of SIZES) {
		const outPath = path.join(OUT_DIR, `icon${size}.png`);
		if (size === CANVAS) {
			await sharp(padded128).toFile(outPath);
		} else {
			await sharp(padded128).resize(size, size, { kernel: 'linear' }).png().toFile(outPath);
		}
	}
	console.log(`Wrote icon${SIZES.join('.png, icon')}.png to ${OUT_DIR}`);
})();
