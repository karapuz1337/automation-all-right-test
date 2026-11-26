import { expect, test } from '@playwright/test';

test.use({ testIdAttribute: 'data-test' });

test("Show catalog names and prices", async ({ page }) => {
  await page.goto('https://www.saucedemo.com/');
  await page.getByTestId('username').fill('standard_user');
  await page.getByTestId('password').fill('secret_sauce');
  await page.getByTestId('login-button').click();
  await expect(page).toHaveURL('https://www.saucedemo.com/inventory.html');
  const cards = page.getByTestId('inventory-list').getByTestId('inventory-item');
  await expect(cards.first()).toBeVisible();
  for (const card of await cards.all()) {
    const name = card.getByTestId('inventory-item-name');
    const price = card.getByTestId('inventory-item-price');
    await expect(name).toBeVisible();
    await expect(name).toHaveText(/\S/);
    await expect(price).toBeVisible();
    await expect(price).toHaveText(/^\$\d+\.\d{2}$/);
  }
});
