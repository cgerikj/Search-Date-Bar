// Fast Node unit tests (no browser) for the result-count parsing/abbreviation.
// Run: npm run test:unit   (or: node --test tests)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { abbreviateCount, parseResultCount } = require('../src/result-count');

test('abbreviateCount — short-scale K/M/B/T, no trailing .0', () => {
	assert.equal(abbreviateCount(0), '0');
	assert.equal(abbreviateCount(42), '42');
	assert.equal(abbreviateCount(999), '999');
	assert.equal(abbreviateCount(1000), '1K');
	assert.equal(abbreviateCount(1500), '1.5K');
	assert.equal(abbreviateCount(146), '146');
	assert.equal(abbreviateCount(1_000_000), '1M');
	assert.equal(abbreviateCount(151_000_000), '151M');
	assert.equal(abbreviateCount(1_234_567), '1.2M');
	assert.equal(abbreviateCount(3_040_000_000), '3B');
	assert.equal(abbreviateCount(2_980_000_000), '3B'); // rounds 2.98 -> 3.0
	assert.equal(abbreviateCount(1_234_000_000_000), '1.2T');
});

test('parseResultCount — real desktop strings', () => {
	assert.equal(parseResultCount('About 3,040,000,000 results (0.47s)'), '3B');
	assert.equal(parseResultCount('About 2,980,000,000 results (0.45s)'), '3B');
	assert.equal(parseResultCount('About 134 results (0.40s)'), '134');
	assert.equal(parseResultCount('About 151,000,000 results (0.32 seconds)'), '151M');
});

test('parseResultCount — locale grouping separators', () => {
	assert.equal(parseResultCount('Ungefähr 3.040.000.000 Ergebnisse'), '3B'); // de: dot
	assert.equal(parseResultCount('Environ 3 040 000 000 résultats'), '3B'); // fr: space
	assert.equal(parseResultCount('約 3,040,000,000 件'), '3B'); // ja
	assert.equal(parseResultCount('3 040 000 000 results'), '3B'); // no-break space
	assert.equal(parseResultCount('3 040 000 results'), '3M'); // narrow no-break space
});

test('parseResultCount — no count / empty', () => {
	assert.equal(parseResultCount(''), null);
	assert.equal(parseResultCount(null), null);
	assert.equal(parseResultCount(undefined), null);
	assert.equal(parseResultCount('No results found'), null);
});

test('parseResultCount — refuses pre-abbreviated forms rather than misreading', () => {
	assert.equal(parseResultCount('About 3.4M results'), null);
	assert.equal(parseResultCount('3.2B results'), null);
});

test('parseResultCount — ignores the trailing time, not just the count', () => {
	// The leading number is the count; the "(0.47s)" must never be picked up.
	assert.equal(parseResultCount('About 5 results (0.47s)'), '5');
});
