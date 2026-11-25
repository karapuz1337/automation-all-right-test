# Playwright QA assessment

This TypeScript suite checks the [SauceDemo](https://www.saucedemo.com) storefront and the [Restful Booker](https://restful-booker.herokuapp.com/apidoc) API.

Both projects use Playwright Test for execution, assertions, and reporting. The API project sends requests through a bounded Node HTTPS helper rather than Playwright's request fixture.

## Run locally

Use Node.js 24 LTS with npm. The first install needs internet access to download dependencies and Chromium; the tests need access to both demo sites. Run these commands from the repository root:

```sh
node --version
npm --version
npm ci
npm run lint
npm run typecheck
npx --no-install playwright install chromium
npm test
```

On a Linux machine missing browser dependencies, use `npx --no-install playwright install --with-deps chromium` instead. The suite uses public demo credentials and synthetic data; no secrets or `.env` file are needed.

ESLint checks TypeScript and Playwright tests. Run `npm run lint:fix` for supported automatic fixes. In a Git clone, `npm ci` installs the Husky pre-commit hook, which runs lint before each commit. CI runs lint explicitly.

```sh
npm test -- --project=ui
npm test -- --project=api
npm test -- --project=ui --grep '\bAC-08\b'
npx --no-install playwright show-report .runtime/playwright-report
```

The last command opens the most recent local HTML report at its default path. Run the full suite before opening it if you want results for both projects.

## Coverage

| ID | Project | Behavior checked |
| --- | --- | --- |
| AC-01 | UI | Valid `standard_user` sign-in opens a visible inventory list. |
| AC-02 | UI | The catalog is nonempty and its product cards show names and valid prices. |
| AC-03 | UI | Low-to-high sorting puts at least two distinct prices in numeric order. |
| AC-04 | UI | Adding a named product shows a cart badge of one and puts that exact product in the cart. |
| AC-05 | UI | Removing that product empties the cart and clears the badge. |
| AC-06 | UI | Checkout shows the selected product in the overview and confirms the order after Finish. |
| AC-07 | UI | A wrong password shows an error and does not open inventory. |
| AC-08 | UI | A blank username with the demo password shows the username-required error and does not open inventory. |
| AC-09 | UI | Omitting only the postal code shows a validation error and does not open checkout overview. |
| AC-10 | API | Authenticate, create a booking, update it, read back the changes, delete it, then verify that the same ID returns `404`. |
| AC-11 | API | Incorrect demo credentials are rejected without issuing a usable token. |
| AC-12 | API | A read-only request for an ID outside the positive booking ID range returns `404` with `Not Found`. |

Deliberately excluded: other SauceDemo profiles and browsers, exhaustive field permutations, invalid API writes, load and security testing, and the optional test-generation bonus. API writes are limited to a booking created by the current test.

## Verified locally

On November 25, 2026, independent QA verified the corrected suite from a clean source snapshot on Node 24. The lockfile install and type check passed. One full run passed all 12 cases (9 UI, 3 API), with no failures, skips, or retries. Each case also passed in isolation across the two QA rounds; AC-01–11 were unchanged in the second round. The full HTML report was opened in Chromium.

## GitHub Actions report

Open the run for your commit in the repository's [Actions tab](https://github.com/karapuz1337/automation-all-right-test/actions). The **Summary** shows project counts and per-test statuses without a download. For full Playwright details, download `playwright-report` from **Artifacts**, extract the whole archive, and open `index.html` or run `npx --no-install playwright show-report <extracted-directory>`. GitHub packages artifacts as ZIP files and may require sign-in to download them.

When tests generate results, the workflow publishes the summary and HTML artifact after either a pass or a failure. The HTML report omits Git commit and diff metadata.

## Product defects

No product defect was confirmed. The first AC-12 fixture assumed that a large positive booking ID was unused, but the read returned `200`. That exposed a mistake in fixture selection; QA did not diagnose why the API returned `200`. The corrected fixture uses `-1`, outside the positive ID range, and returned the expected `404` and `Not Found` in isolation and in the full run.

For any confirmed defect, record: title and affected case ID, environment and time, prerequisites and exact reproduction steps, expected result, actual result, and reproducible supporting evidence with credentials and personal data removed.