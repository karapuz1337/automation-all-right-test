import { expect, test, type Page } from '@playwright/test';

test.use({ testIdAttribute: 'data-test' });

const username = 'standard_user';
const demoPassword = 'secret_sauce';
const product = 'Sauce Labs Backpack';
const addBackpack = 'add-to-cart-sauce-labs-backpack';
const priceFormat = /^\$\d+\.\d{2}$/;

function cents(price: string): number {
  return Number(price.replace(/\D/g, ''));
}

async function login(page: Page) {
  await page.goto('/');
  await page.getByTestId('username').fill(username);
  await page.getByTestId('password').fill(demoPassword);
  await page.getByTestId('login-button').click();
}

test('AC-01 valid login opens the inventory', async ({ page }) => {
  await login(page);

  await expect(page).toHaveURL('/inventory.html');
  await expect(page.getByTestId('inventory-list')).toBeVisible();
});

test('AC-02 catalog cards show product names and valid prices', async ({ page }) => {
  await login(page);

  const cards = page.getByTestId('inventory-list').getByTestId('inventory-item');
  await expect(cards.first()).toBeVisible();
  const catalog = await cards.all();
  expect(catalog.length).toBeGreaterThan(0);
  for (const card of catalog) {
    const name = card.getByTestId('inventory-item-name');
    const price = card.getByTestId('inventory-item-price');
    await expect(name).toBeVisible();
    await expect(name).toHaveText(/\S/);
    await expect(price).toBeVisible();
    await expect(price).toHaveText(priceFormat);
  }
});

test('AC-03 price sort displays products from low to high', async ({ page }) => {
  await login(page);

  await page.getByTestId('product-sort-container').selectOption({ label: 'Price (low to high)' });

  const visiblePrices = page.getByTestId('inventory-list')
    .getByTestId('inventory-item-price')
    .filter({ visible: true });
  await expect(async () => {
    const displayed = await visiblePrices.allInnerTexts();
    for (const price of displayed) {
      expect(price).toMatch(priceFormat);
    }
    const prices = displayed.map((price) => BigInt(price.slice(1).replace('.', '')));
    expect(new Set(prices).size).toBeGreaterThanOrEqual(2);
    expect(prices).toEqual([...prices].sort((a, b) => a < b ? -1 : a > b ? 1 : 0));
  }).toPass({ timeout: 5_000 });
});

test('AC-04 adding a product shows one on the badge and the exact product in the cart', async ({ page }) => {
  await login(page);

  const badge = page.getByTestId('shopping-cart-badge');
  await expect(badge).toHaveCount(0);
  await page.getByTestId(addBackpack).click();
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('1');
  await page.getByTestId('shopping-cart-link').click();

  await expect(page).toHaveURL('/cart.html');
  const cartItem = page.getByTestId('cart-list').getByTestId('inventory-item-name');
  await expect(cartItem).toBeVisible();
  await expect(cartItem).toHaveText(product);
});

test('AC-05 removing the product empties the cart and clears the badge', async ({ page }) => {
  await login(page);
  await page.getByTestId(addBackpack).click();
  await page.getByTestId('shopping-cart-link').click();

  const cart = page.getByTestId('cart-list');
  await expect(cart.getByTestId('inventory-item-name')).toHaveText(product);
  await cart.getByTestId('remove-sauce-labs-backpack').click();

  await expect(cart).toBeVisible();
  await expect(cart.getByTestId('inventory-item')).toHaveCount(0);
  await expect(page.getByTestId('shopping-cart-badge')).toHaveCount(0);
});

test('AC-06 checkout shows the selected product and correct total, then confirms the order', async ({ page }) => {
  await login(page);
  await page.getByTestId(addBackpack).click();
  await page.getByTestId('shopping-cart-link').click();
  const cartPrice = page.getByTestId('cart-list').getByTestId('inventory-item-price');
  await expect(cartPrice).toHaveText(priceFormat);
  const itemPrice = (await cartPrice.innerText()).trim();

  await page.getByTestId('checkout').click();
  await page.getByTestId('firstName').fill('Demo');
  await page.getByTestId('lastName').fill('Tester');
  await page.getByTestId('postalCode').fill('12345');
  await page.getByTestId('continue').click();

  await expect(page).toHaveURL('/checkout-step-two.html');
  const overview = page.getByTestId('cart-list');
  await expect(overview.getByTestId('inventory-item-name')).toBeVisible();
  await expect(overview.getByTestId('inventory-item-name')).toHaveText(product);
  await expect(overview.getByTestId('inventory-item-price')).toHaveText(itemPrice);
  await expect(page.getByTestId('subtotal-label')).toHaveText(`Item total: ${itemPrice}`);
  const tax = page.getByTestId('tax-label');
  const total = page.getByTestId('total-label');
  await expect(tax).toHaveText(/^Tax: \$\d+\.\d{2}$/);
  await expect(total).toHaveText(/^Total: \$\d+\.\d{2}$/);
  expect(cents(await total.innerText()), 'Total equals the item price plus displayed tax')
    .toBe(cents(itemPrice) + cents(await tax.innerText()));
  await page.getByTestId('finish').click();

  await expect(page).toHaveURL('/checkout-complete.html');
  const confirmation = page.getByTestId('complete-header');
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toHaveText('Thank you for your order!');
});

test('AC-07 wrong password is rejected without opening the inventory', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('username').fill(username);
  await page.getByTestId('password').fill('not-the-demo-password');
  await page.getByTestId('login-button').click();

  const error = page.getByTestId('error');
  await expect(error).toBeVisible();
  await expect(error).toHaveText('Epic sadface: Username and password do not match any user in this service');
  await expect(page).toHaveURL('/');
});

test('AC-08 blank username is rejected without opening the inventory', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('username')).toHaveValue('');
  await page.getByTestId('password').fill(demoPassword);
  await page.getByTestId('login-button').click();

  const error = page.getByTestId('error');
  await expect(error).toBeVisible();
  await expect(error).toHaveText('Epic sadface: Username is required');
  await expect(page).toHaveURL('/');
});

test('AC-09 checkout requires a postal code before showing the overview', async ({ page }) => {
  await login(page);
  await page.getByTestId(addBackpack).click();
  await page.getByTestId('shopping-cart-link').click();
  await page.getByTestId('checkout').click();
  await page.getByTestId('firstName').fill('Demo');
  await page.getByTestId('lastName').fill('Tester');
  await expect(page.getByTestId('postalCode')).toHaveValue('');
  await page.getByTestId('continue').click();

  const error = page.getByTestId('error');
  await expect(error).toBeVisible();
  await expect(error).toHaveText('Error: Postal Code is required');
  await expect(page).toHaveURL('/checkout-step-one.html');
});
