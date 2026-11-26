# SauceDemo text-to-Playwright generator

The generator sends a plain-text case to `droid exec`. The model returns a structured action plan, not executable code. The generator checks that plan against the supported journeys and renders a TypeScript Playwright spec from fixed templates. It does not run the spec. Review the result against your input before running it.

## 1. Set up

Run the commands from the repository root with Node 24. Sign in to Droid and check that `droid --version` works in the same terminal. To run the generated specs, follow [Review in a visible browser](../README.md#review-in-a-visible-browser) to install Playwright and Chromium.

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

The generator supports four cases: confirming that standard-user sign-in opens the inventory, checking catalog names and prices, checking that one product appears in the cart, and confirming that checkout rejects an empty postal code. For cart and checkout cases, name one supported product: Sauce Labs Backpack, Sauce Labs Bike Light, or Sauce Labs Bolt T-Shirt. The generator does not support other sites, sorting or filtering, multiple items, custom form values, or completing checkout.

## 3. Generate, review and run

Run this in your project terminal from the repository root. Replace the example path with your own `.txt` file. Keep the quotes if the path contains spaces.

```sh
npm run generate-test-case -- "bonus/examples/cart-bike-light.txt"
```

No PowerShell script, alias, or global installation is needed. The command saves a new `.spec.ts` under `.runtime/bonus-generated/` and prints its path. Open it in your editor and compare the actions and assertions with your text case. If they match, copy the `After reviewing, run:` command printed in the terminal to run just that spec in Chromium. Remove `--headed` from that command to run without a visible browser.

If the generator rejects the case, check the headings and supported steps. If it cannot start Droid, check installation, sign-in, and model access. If the assertions do not match, do not run the spec. Clarify the input and rerun the same command. Each run generates a fresh filename without overwriting earlier specs.

## Verified examples

| Input | What the spec checks | Saved output | Headed Chromium | Manual changes |
| --- | --- | --- | --- | --- |
| [`catalog.txt`](examples/catalog.txt) | Sign in and check visible catalog cards for nonempty names and dollar-and-cent prices. | [`generated-catalog.spec.ts`](examples/generated-catalog.spec.ts) | Pass | None |
| [`cart-bike-light.txt`](examples/cart-bike-light.txt) | Add a Sauce Labs Bike Light and check the cart shows that product with a badge count of one. | [`generated-cart-bike-light.spec.ts`](examples/generated-cart-bike-light.spec.ts) | Pass | None |
| [`postal-code-required.txt`](examples/postal-code-required.txt) | Add a Sauce Labs Backpack, start checkout, and submit with a blank postal code. The information form stays open and shows `Error: Postal Code is required`. | [`generated-postal-code-required.spec.ts`](examples/generated-postal-code-required.spec.ts) | Pass | Corrected the generator prompt, not the spec |

The original checkout prompt led the model to emit a placeholder instead of a product action. The prompt now uses `add:backpack` as an example. No generated TypeScript was edited by hand. On November 26, 2026, the generator reproduced all three saved specs byte for byte, and all three passed together in headed Chromium (`3 passed`, 4.2 s).

Try the other two cases with the same command:

```sh
npm run generate-test-case -- "bonus/examples/catalog.txt"
npm run generate-test-case -- "bonus/examples/postal-code-required.txt"
```

The default Playwright config does not discover these specs. The bonus config runs generated files under `.runtime/bonus-generated`, not the saved examples linked above.

For offline checks, run `node --test bonus/generator.test.ts` and `npm run typecheck -- --project bonus/tsconfig.json`. Neither command calls Droid or opens a browser.
