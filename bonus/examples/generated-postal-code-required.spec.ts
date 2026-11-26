import { expect, test } from '@playwright/test';

test.use({ testIdAttribute: 'data-test' });

test("Checkout requires postal code", async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await expect(page).toHaveURL('https://www.saucedemo.com/inventory.html');
  await page.getByTestId('add-to-cart-sauce-labs-backpack').click();
  await page.getByTestId('shopping-cart-link').click();
  await expect(page).toHaveURL('https://www.saucedemo.com/cart.html');
  await page.getByTestId('checkout').click();
  await expect(page).toHaveURL('https://www.saucedemo.com/checkout-step-one.html');
  await page.getByTestId('firstName').fill('Demo');
  await page.getByTestId('lastName').fill('Tester');
  await expect(page.getByTestId('postalCode')).toHaveValue('');
  await page.getByTestId('continue').click();
  const error = page.getByTestId('error');
  await expect(error).toBeVisible();
  await expect(error).toHaveText('Error: Postal Code is required');
  await expect(page).toHaveURL('https://www.saucedemo.com/checkout-step-one.html');
});
