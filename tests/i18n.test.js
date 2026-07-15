// Fast Node unit tests (no browser) for the _locales message catalogs.
// Guards the classic i18n bugs: invalid JSON, and a locale that's missing or
// has stray keys relative to the `en` base (a getMessage("...") that silently
// returns "" at runtime). Run: npm run test:unit
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const LOCALES_DIR = path.join(__dirname, '../src/_locales');
const DEFAULT_LOCALE = 'en';
// Chrome's manifest "name" (which we localize via __MSG_extName__) caps at 75;
// the store summary / manifest "description" (__MSG_extDescription__) caps at 132.
const MAX_NAME_LENGTH = 75;
const MAX_DESCRIPTION_LENGTH = 132;
// Store-listing-only locales: they localize just the Web Store title + summary
// for discoverability. The in-page UI intentionally falls back to `en` (Chrome
// merges the default locale under the active one), so they carry ONLY the two
// store keys and are exempt from full key-parity.
const STORE_ONLY_LOCALES = new Set(['it', 'id', 'pl', 'ar']);
const STORE_KEYS = ['extName', 'extDescription'];

function loadMessages(locale) {
	const file = path.join(LOCALES_DIR, locale, 'messages.json');
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const locales = fs.readdirSync(LOCALES_DIR).filter((entry) =>
	fs.statSync(path.join(LOCALES_DIR, entry)).isDirectory()
);
const fullLocales = locales.filter((l) => !STORE_ONLY_LOCALES.has(l));
const baseKeys = Object.keys(loadMessages(DEFAULT_LOCALE)).sort();

test('valid JSON; full locales match en keys exactly, store-only carry the store keys', () => {
	assert.ok(locales.includes(DEFAULT_LOCALE), 'en base locale must exist');
	for (const locale of locales) {
		const keys = Object.keys(loadMessages(locale)).sort();
		if (STORE_ONLY_LOCALES.has(locale)) {
			for (const k of STORE_KEYS) assert.ok(keys.includes(k), `${locale} missing store key ${k}`);
			for (const k of keys) assert.ok(baseKeys.includes(k), `${locale} has stray key not in ${DEFAULT_LOCALE}: ${k}`);
		} else {
			assert.deepEqual(keys, baseKeys, `${locale} key set differs from ${DEFAULT_LOCALE}`);
		}
	}
});

test('every message has a non-empty string value', () => {
	for (const locale of locales) {
		const messages = loadMessages(locale);
		for (const [key, entry] of Object.entries(messages)) {
			assert.equal(typeof entry.message, 'string', `${locale}.${key} missing message string`);
			assert.ok(entry.message.trim().length > 0, `${locale}.${key} is empty`);
		}
	}
});

test('placeholder messages keep their $date$ token and declare the placeholder', () => {
	for (const locale of fullLocales) {
		const messages = loadMessages(locale);
		for (const key of ['afterDate', 'beforeDate']) {
			const entry = messages[key];
			assert.ok(entry.message.includes('$date$'), `${locale}.${key} lost the $date$ token`);
			assert.ok(entry.placeholders && entry.placeholders.date, `${locale}.${key} missing placeholders.date`);
			assert.equal(entry.placeholders.date.content, '$1', `${locale}.${key} placeholder must map to $1`);
		}
	}
});

test('localized extension name stays within the 75-char manifest limit', () => {
	for (const locale of locales) {
		const name = loadMessages(locale).extName.message;
		assert.ok(name.length <= MAX_NAME_LENGTH, `${locale} extName is ${name.length} chars (max ${MAX_NAME_LENGTH})`);
	}
});

test('localized store description stays within the 132-char summary limit', () => {
	for (const locale of locales) {
		const description = loadMessages(locale).extDescription.message;
		assert.ok(description.length <= MAX_DESCRIPTION_LENGTH, `${locale} extDescription is ${description.length} chars (max ${MAX_DESCRIPTION_LENGTH})`);
	}
});
