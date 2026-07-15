// Zips src/ for Chrome Web Store upload.
// Run: node scripts/release.js
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const SRC_DIR = path.resolve(__dirname, '../src');
const OUT_DIR = path.resolve(__dirname, '../release');

const REQUIRED = ['manifest.json', 'content.js', 'styles.css', 'icons'];
for (const name of REQUIRED) {
	if (!fs.existsSync(path.join(SRC_DIR, name))) {
		console.error(`Missing src/${name} — aborting.`);
		process.exit(1);
	}
}

const manifest = JSON.parse(fs.readFileSync(path.join(SRC_DIR, 'manifest.json'), 'utf-8'));
const version = manifest.version;

fs.mkdirSync(OUT_DIR, { recursive: true });
const outPath = path.join(OUT_DIR, `google-search-by-date-v${version}.zip`);

const output = fs.createWriteStream(outPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
	console.log(`Wrote ${outPath} (${(archive.pointer() / 1024).toFixed(1)} KB)`);
	console.log('Upload it as-is at https://chrome.google.com/webstore/devconsole');
});
archive.on('warning', (err) => {
	throw err;
});
archive.on('error', (err) => {
	throw err;
});

archive.pipe(output);
// directory(SRC_DIR, false) flattens so manifest.json lands at the zip root, not under src/.
archive.directory(SRC_DIR, false);
archive.finalize();
