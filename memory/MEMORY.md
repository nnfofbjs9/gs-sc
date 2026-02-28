# Project Memory

## Test Suite

- **Run tests**: `npm test` or `npx playwright test tests/auth tests/smoke tests/grading tests/reports tests/student tests/learning-summaries tests/edge-cases`
- **Config**: `playwright.config.ts` — 2 workers, retries: 1, targets `https://gs-sc.vercel.app`
- **Credentials**: `.env.test` — `claude_test@enrichmentexpress.test` / `TestPass123!`
- **Result baseline**: 56 passed, 11 skipped (intentional — no data to click), 0 failed

### Key DOM Facts (post-login)
- App is React-via-Babel (not bundled React), globals: `window.React`, `window.supabase`
- Post-login structure: `body > div#root > div.min-h-screen > header + ...`
- `header` element is rendered by React and only appears after authenticated
- Nav buttons (`Scanner`, `History`, `Batches`) use `class="hidden md:flex"` — CSS-hidden on mobile
- User email in header: `<span class="hidden sm:inline">` — CSS-hidden on mobile viewports

### Auth Helper Fix (auth.helper.ts)
- Login success signal: `page.waitForSelector('header', { state: 'attached', timeout: 30000 })`
- `toBeVisible()` fails on mobile because nav is CSS-hidden
- `state: 'attached'` works on all viewport sizes

### Skipped Tests (expected — no UI element present)
- `should validate grade input range` — no number inputs on scanner page
- `should handle image upload for OCR` — no file input attribute to check
- `should save grades successfully` — no save button without data
- `should display students in a batch` — needs data to click into
- `should allow adding students to batch` — needs batch selected first
- `should display report with student feedback` — no View button visible
- `should show PlayPack activities in reports` — no View button visible
- `should validate required fields` — no submit button found
- `should handle browser back/forward navigation` — explicitly test.skip'd
- `should handle special characters in input` — no text inputs on default view
- `should prevent SQL injection in inputs` — no text inputs on default view
