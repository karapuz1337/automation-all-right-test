import { expect, test } from '@playwright/test';

test.use({ testIdAttribute: 'data-test' });

test("Cart contains one Bike Light", async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await expect(page).toHaveURL('https://www.saucedemo.com/inventory.html');
  await page.getByTestId('add-to-cart-sauce-labs-bike-light').click();
  await page.getByTestId('shopping-cart-link').click();
  await expect(page).toHaveURL('https://www.saucedemo.com/cart.html');
  const badge = page.getByTestId('shopping-cart-badge');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('1');
  const item = page.getByTestId('cart-list').getByTestId('inventory-item-name');
  await expect(item).toBeVisible();
  await expect(item).toHaveText('Sauce Labs Bike Light');
});
