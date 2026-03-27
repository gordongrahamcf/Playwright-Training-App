export const SCENARIO_1 = `
test('shows loading spinner then user list after fetch', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/async');

  await page.getByTestId('btn-fetch-users').click();

  await expect(page.getByTestId('loading-spinner')).toBeVisible();
  await expect(page.getByTestId('user-list')).toBeVisible();
  await expect(page.getByTestId('loading-spinner')).not.toBeVisible();
  await expect(page.getByTestId('user-card')).toHaveCount(5);
});
`

export const SCENARIO_2 = `
test('filters results after debounce delay', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/async');

  await page.getByTestId('search-input').fill('Widget');

  // Wait for debounce to fire (400ms + small buffer)
  await page.waitForTimeout(600);

  await expect(page.getByTestId('search-result-count')).toContainText('3');
  await expect(page.getByTestId('search-results')).toContainText('Blue Widget');
  await expect(page.getByTestId('search-results')).toContainText('Red Widget');
  await expect(page.getByTestId('search-results')).toContainText('Chrome Widget');
});
`

export const SCENARIO_3 = `
test('loads 5 more items on each load-more click', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/async');

  await expect(page.getByTestId('list-item')).toHaveCount(5);

  await page.getByTestId('btn-load-more').click();

  await expect(page.getByTestId('load-more-spinner')).toBeVisible();
  await expect(page.getByTestId('list-item')).toHaveCount(10);
  await expect(page.getByTestId('load-more-spinner')).not.toBeVisible();
});
`

export const SCENARIO_4 = `
test('hides load-more button when all items are loaded', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/async');

  for (let i = 0; i < 3; i++) {
    await page.getByTestId('btn-load-more').click();
    await expect(page.getByTestId('load-more-spinner')).not.toBeVisible();
  }

  await expect(page.getByTestId('list-item')).toHaveCount(20);
  await expect(page.getByTestId('btn-load-more')).not.toBeVisible();
});
`
