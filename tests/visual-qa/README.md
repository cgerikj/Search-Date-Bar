# Visual QA tool

Manual visual-regression tooling. Loads the real unpacked extension into a
live `google.com` search across a range of page types, states, locales,
and interactions, screenshots each one, and assembles them into an HTML
gallery.

Not part of `npm test` — run on demand for a visual sanity check (e.g.
after a CSS/layout change).

## Usage

```
node tests/visual-qa/capture.js   # runs SCENARIOS, screenshots each
node tests/visual-qa/gallery.js   # builds gallery.html from the screenshots
```

Output: `tests/visual-qa/output/gallery.html`.

## Notes

- Uses the same throwaway profile and CAPTCHA-wait logic as the rest of
  the test suite (`tests/fixtures/extension.js`).
- Runs scenarios sequentially, one browser context at a time, to avoid
  hammering google.com.
- Screenshots are gitignored; only the tool itself is tracked. Output
  lives outside `test-results/` since Playwright wipes that on every run.
- Filter to a subset: `node tests/visual-qa/capture.js <substring>`.
- New scenario: add an entry to `SCENARIOS` in `capture.js` — a unique
  `name`, plus either `query`/`params`/`viewport`, or an `interact(page)`
  callback.
