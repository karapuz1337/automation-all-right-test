# SauceDemo text-to-Playwright generator

The generator sends a plain-text case to `droid exec`. The model returns a structured action plan, not executable code. The generator checks that plan against the supported journeys and renders a TypeScript Playwright spec from fixed templates. It does not run the spec. Review the result against your input before running it.

## 1. Set up

From the repository root on `feat/playwright-test-generator`, use Node 24 and follow [Review in a visible browser](../README.md#review-in-a-visible-browser) to install Playwright and Chromium. Sign in to Droid and make sure `droid --version` works in the same terminal.

Use synthetic cases only. The generator sends the case text to the configured model. Its scratch files live under `.runtime/bonus-provider`, but Droid may save case text in the configured Factory home and load repository configuration. The generator disables user, project, and plugin hooks for its one-shot child process only so workflow hooks do not prompt for extra turns. Organization-managed hooks still apply. No global settings are changed.

## 2. Write a plain-text case

Save one case as a UTF-8 `.txt` file, at most 2,400 bytes. Start with an optional `Title:`, then add `Steps:` and `Expected result:` on their own lines. Write the steps in order and say what should be visible at the end. You don't need code, selectors, or credentials.

```text
Title: One Bike Light in the cart
Steps:
1. Sign in to SauceDemo with the standard demo account.
2. Add the Sauce Labs Bike Light to the cart.
3. Open the shopping cart.
Expected result:
The cart shows the Sauce Labs Bike Light and the cart badge shows 1.
```

Supported cases: standard-user sign-in and inventory visibility; catalog names and prices; adding exactly one product and checking the cart; or submitting checkout with the postal code empty and checking the validation error. For cart and checkout, name one supported product: Sauce Labs Backpack, Sauce Labs Bike Light, or Sauce Labs Bolt T-Shirt. Other sites, sort/filter actions, multiple items, custom form values, and completing checkout are not supported.

## 3. Generate, review and run

Try the bundled Bike Light input, or replace its path with your own `.txt` file:

```powershell
$name = 'bike-' + (Get-Date -Format yyyyMMddHHmmss)
node bonus/generate.ts bonus/examples/cart-bike-light.txt $name
Get-Content -LiteralPath ".runtime/bonus-generated/generated-$name.spec.ts"
```

Compare the generated actions and assertions with the text case. Then run just that spec:

```powershell
$filter = [regex]::Escape("generated-$name.spec.ts") + '$'
node node_modules/playwright/cli.js test -c bonus/playwright.config.ts --headed $filter
```

Omit `--headed` to run without a visible browser. Omit the output name from `node bonus/generate.ts <case.txt> [name]` to print TypeScript instead of saving. Names start with a lowercase letter or digit, may also contain hyphens, and are limited to 40 characters. Existing files are never overwritten.

If the generator rejects the case, check the headings and supported steps. If it cannot start Droid, check installation, sign-in, and model access. If the generated assertions do not match your case, do not run them; clarify the input and generate again under a fresh name.

## Verified examples

| Input | What the spec checks | Saved output | Headed Chromium | Manual changes |
| --- | --- | --- | --- | --- |
| [`catalog.txt`](examples/catalog.txt) | Sign in and check visible catalog cards for nonempty names and dollar-and-cent prices. | [`generated-catalog.spec.ts`](examples/generated-catalog.spec.ts) | Pass | None |
| [`cart-bike-light.txt`](examples/cart-bike-light.txt) | Add a Sauce Labs Bike Light and check the cart shows that product with a badge count of one. | [`generated-cart-bike-light.spec.ts`](examples/generated-cart-bike-light.spec.ts) | Pass | None |
| [`postal-code-required.txt`](examples/postal-code-required.txt) | Add a Sauce Labs Backpack, start checkout, and submit with a blank postal code. The information form stays open and shows `Error: Postal Code is required`. | [`generated-postal-code-required.spec.ts`](examples/generated-postal-code-required.spec.ts) | Pass | Corrected the generator prompt, not the spec |

The original checkout prompt led the model to emit a placeholder instead of a product action. The prompt now uses a concrete `add:backpack` example. All three saved specs match the regenerated files byte for byte; no generated TypeScript was edited by hand. The three fresh files passed together in one headed Chromium run (`3 passed`, 3.5 s reported by Playwright).

The default Playwright config does not discover these specs. The bonus config runs generated files under `.runtime/bonus-generated`, not the saved examples linked above. Named generation never overwrites a file; use a fresh tag if rerunning.

For offline checks, run `node --test bonus/generator.test.ts` and `npm run typecheck -- --project bonus/tsconfig.json`. Neither command calls Droid or opens a browser.

```powershell
$tag = Get-Date -Format yyyyMMddHHmmss
node bonus/generate.ts bonus/examples/catalog.txt "$tag-catalog"
node bonus/generate.ts bonus/examples/cart-bike-light.txt "$tag-cart-bike-light"
node bonus/generate.ts bonus/examples/postal-code-required.txt "$tag-postal"

# Compare each generated file with its input before running the tests.
$files = @("generated-$tag-catalog.spec.ts", "generated-$tag-cart-bike-light.spec.ts", "generated-$tag-postal.spec.ts")
$files | ForEach-Object { Get-Content -LiteralPath ".runtime/bonus-generated/$_" }
```

Once all three files have been generated and reviewed, run just those files:

```powershell
$filters = $files | ForEach-Object { [regex]::Escape($_) + '$' }
node node_modules/playwright/cli.js test -c bonus/playwright.config.ts --headed @filters
```
