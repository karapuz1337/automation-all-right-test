import { expect, test } from '@playwright/test';

test.use({ testIdAttribute: 'data-test' });

test('SD-01 rejects a postal code containing only spaces', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  await page.getByTestId('shopping-cart-link').click();
  await page.getByTestId('checkout').click();
  await expect(page).toHaveURL('/checkout-step-one.html');
  await page.getByTestId('firstName').fill('Demo');
  await page.getByTestId('lastName').fill('Tester');

  const postalCode = page.getByTestId('postalCode');
  const error = page.getByTestId('error');
  const required = 'Error: Postal Code is required';

  // Control: the same form rejects an empty postal code.
  await expect(postalCode).toHaveValue('');
  await page.getByTestId('continue').click();
  await expect(error).toBeVisible();
  await expect(error).toHaveText(required);
  await expect(page).toHaveURL('/checkout-step-one.html');

  await postalCode.fill('   ');
  await expect(postalCode).toHaveValue('   ');
  await page.getByTestId('continue').click();

  await expect(page).toHaveURL('/checkout-step-one.html');
  await expect(error).toBeVisible();
  await expect(error).toHaveText(required);
});
