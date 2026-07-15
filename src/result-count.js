'use strict';

// Pure helpers for the result-count readout, split out so they can be
// unit-tested in Node (tests/result-count-parsing.test.js) without a browser.
// Loaded as a content script before content.js, which shares this scope.

// Short-scale count abbreviations (K/M/B/T), not SI — a result count is a
// count of things, so "3B" reads right where SI's "3G" wouldn't.
function abbreviateCount(n) {
	const tiers = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
	for (const [value, symbol] of tiers) {
		if (n >= value) return (n / value).toFixed(1).replace(/\.0$/, "") + symbol;
	}
	return String(n);
}

// Turns Google's #result-stats text into a short count, e.g.
// "About 3,040,000,000 results (0.47s)" -> "3B". Reads the leading integer
// only, so it's locale-safe: the surrounding words are ignored, and grouping
// separators (comma, period, and any kind of space — \s covers no-break and
// narrow spaces) are stripped. Returns null when there's no count, or when the
// number is already abbreviated (e.g. "3.4M") — which can't be safely stripped
// — rather than misreading it.
function parseResultCount(text) {
	if (!text) return null;
	text = String(text);
	const match = text.match(/\d[\d.,\s]*/);
	if (!match) return null;
	// A magnitude letter immediately after the number means it's pre-abbreviated.
	const numberEnd = match.index + match[0].replace(/[.,\s]+$/, "").length;
	if (/[KMBGT]/i.test(text.charAt(numberEnd))) return null;
	const digits = match[0].replace(/\D/g, "");
	return digits ? abbreviateCount(parseInt(digits, 10)) : null;
}

if (typeof module !== "undefined" && module.exports) {
	module.exports = { abbreviateCount, parseResultCount };
}
