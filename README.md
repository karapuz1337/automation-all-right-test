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

ESLint checks TypeScript and Playwright tests. Run `npm run lint:fix` to apply supported fixes yourself. In a Git clone, `npm ci` installs the Husky pre-commit hook. The hook runs lint and TypeScript checks without editing or staging files. CI runs both checks explicitly.

TypeScript targets ES2025, the latest fixed target supported by this project's compiler. The config type-checks without emitting JavaScript; Node 24 runs the suite. UI assertions use Playwright's default five-second retry budget, not a fixed sleep. AC-03 sets its polling timeout explicitly because `toPass` does not use the default assertion timeout.

```sh
npm test -- --project=ui
npm test -- --project=api
npm test -- --project=ui --grep '\bAC-08\b'
npx --no-install playwright show-report .runtime/playwright-report
```

The last command opens the most recent local HTML report at its default path. Run the full suite before opening it if you want results for both projects.

## Review in a visible browser

To keep the browser install, cache, and temporary files in this checkout, set these paths in PowerShell before installing or running:

```powershell
$runtime = Join-Path $PWD '.runtime'
$tmp = Join-Path $runtime 'tmp'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$env:TEMP = $env:TMP = $env:TMPDIR = $tmp
$env:npm_config_cache = Join-Path $runtime 'npm-cache'
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $runtime 'browsers'
$env:PLAYWRIGHT_TRANSFORM_CACHE_DIR = Join-Path $runtime 'transform-cache'
npm ci
npx --no-install playwright install chromium
```

Then choose a review mode:

```powershell
npm test -- --headed
npm test -- --project=ui --grep 'AC-06' --debug
npm test -- --ui
```

The first command runs all 13 core tests. Chromium opens for the 9 UI cases; API cases do not use a browser. The second opens Playwright Inspector for checkout. Use step-through to check what each action and assertion actually proves. The third opens an interactive test picker.

## Coverage

| ID | Project | Behavior checked |
| --- | --- | --- |
| AC-01 | UI | Valid `standard_user` sign-in opens a visible inventory list. |
| AC-02 | UI | The catalog is nonempty and its product cards show names and valid prices. |
| AC-03 | UI | Low-to-high sorting puts at least two distinct prices in numeric order. |
| AC-04 | UI | Adding a named product shows a cart badge of one and puts that exact product in the cart. |
| AC-05 | UI | Removing that product empties the cart and clears the badge. |
| AC-06 | UI | Checkout carries the cart price into the overview, shows a matching subtotal and a total equal to subtotal plus displayed tax, and confirms the order after Finish. |
| AC-07 | UI | A wrong password shows an error and does not open inventory. |
| AC-08 | UI | A blank username with the demo password shows the username-required error and does not open inventory. |
| AC-09 | UI | Omitting only the postal code shows a validation error and does not open checkout overview. |
| AC-10 | API | Authenticate, create a booking, update it, read back the changes, delete it, then verify that the same ID returns `404`. |
| AC-11 | API | Incorrect demo credentials are rejected without issuing a usable token. |
| AC-12 | API | A read-only request for an ID outside the positive booking ID range returns `404` with `Not Found`. |
| AC-13 | API | A read-only booking search for a unique synthetic name returns HTTP `200` and an empty list. |

The core suite does not cover other SauceDemo profiles or browsers, exhaustive field combinations, invalid API writes, load testing, or security testing. API writes are limited to a booking created by the current test. The [optional generator](https://github.com/karapuz1337/automation-all-right-test/tree/feat/playwright-test-generator/bonus#readme) runs separately from core CI.

## Verified locally

On November 25, 2026, all 13 cases passed locally in a headed run (9 UI, 4 API). The final API rerun also passed all four cases. The same 13 cases passed on [GitHub Actions](https://github.com/karapuz1337/automation-all-right-test/actions/runs/45886301140) on November 26. The downloaded report matched GitHub's checksum and showed no failures, skips, or retries.

## GitHub Actions report

Open the run for your commit in the repository's [Actions tab](https://github.com/karapuz1337/automation-all-right-test/actions). The **Summary** shows project counts and per-test statuses without a download. For full Playwright details, download `playwright-report` from **Artifacts**, extract the whole archive, and open `index.html` or run `npx --no-install playwright show-report <extracted-directory>`. GitHub packages artifacts as ZIP files and may require sign-in to download them.

When tests generate results, the workflow publishes the summary and HTML artifact after either a pass or a failure. UI failures include a screenshot. Local UI failures also retain a trace, which you can open from the local HTML report. CI does not record traces because they can contain browser state. API captures stay off; API status failures instead show the operation, HTTP status, and a safe response category without exposing raw headers or payloads. The HTML report omits Git commit and diff metadata.

## Product bugs

### SD-01: Checkout accepts a postal code containing only spaces

- **Severity:** Low. Checkout accepts a whitespace-only postal code and advances to the overview. The test did not attempt to complete the order with that value.
- **Environment:** Public SauceDemo, `standard_user`, headed Chromium on Windows, November 25, 2026.
- **Steps:** Add Sauce Labs Backpack to the cart and start checkout. Enter `Demo` and `Tester` for the names. Leave the postal code empty and click **Continue** to confirm the required-field error. Enter three spaces in that field and click **Continue** again.
- **Expected:** The checkout information page stays open and shows `Error: Postal Code is required`. Spaces alone do not provide a postal code.
- **Actual:** The empty value was rejected. Three spaces advanced to checkout overview (`/checkout-step-two.html`). Reproduced twice in fresh browser contexts. The order was not submitted.

The [reproduction test](tests/ui/checkout-postal-code.repro.spec.ts) asserts the expected behavior. It fails while the defect is present and is excluded from the default suite and CI.

```powershell
$env:PW_REPRO_SD_01 = '1'
npm test -- --project=ui --headed
Remove-Item Env:PW_REPRO_SD_01
```

## Test and API observations

### AC-12: Missing-booking test used an ID not known to be absent

- **Environment:** Public Restful Booker demo, November 25, 2026.
- **Steps:** Send a read-only `GET /booking/2147483647` to the demo API. The original test assumed this ID did not exist.
- **Expected:** `404 Not Found` for a known missing booking.
- **Actual:** HTTP `200` in both the isolated test and the full suite. The test did not read the response body, so this does not prove the API mishandled a missing booking.
- **Fix:** Use `GET /booking/-1`, outside the positive booking ID range. The corrected test got HTTP `404` and the body `Not Found`, alone and in the full suite.

AC-11 is a separate API observation: a wrong demo password returned HTTP `200` with `Bad credentials` and no usable token. The test asserts that behavior; it is not evidence of an authentication bypass or a confirmed defect.