export const SCENARIO_1 = `
test('can submit a valid registration form', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/forms');

  await page.getByTestId('input-name').fill('Jane Doe');
  await page.getByTestId('input-email').fill('jane@example.com');
  await page.getByTestId('input-password').fill('securepass123');
  await page.getByTestId('select-role').selectOption('developer');
  await page.getByTestId('checkbox-terms').check();
  await page.getByTestId('radio-newsletter-yes').check();
  await page.getByTestId('btn-submit').click();

  await expect(page.getByTestId('success-message')).toBeVisible();
  await expect(page.getByTestId('success-message')).toContainText('Jane Doe');
});
`

export const SCENARIO_2 = `
test('shows validation errors when submitting empty form', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/forms');

  await page.getByTestId('btn-submit').click();

  await expect(page.getByTestId('error-name')).toBeVisible();
  await expect(page.getByTestId('error-email')).toBeVisible();
  await expect(page.getByTestId('error-password')).toBeVisible();
  await expect(page.getByTestId('error-terms')).toBeVisible();
  await expect(page.getByTestId('success-message')).not.toBeVisible();
});
`

export const SCENARIO_3 = `
test('shows error for password shorter than 8 characters', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/forms');

  await page.getByTestId('input-password').fill('short');
  await page.getByTestId('input-password').blur();

  await expect(page.getByTestId('error-password')).toBeVisible();
  await expect(page.getByTestId('error-password')).toContainText('8 characters');
});
`

export const SCENARIO_4 = `
test('shows error for invalid email format', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/forms');

  await page.getByTestId('input-email').fill('not-an-email');
  await page.getByTestId('input-email').blur();

  await expect(page.getByTestId('error-email')).toBeVisible();
  await expect(page.getByTestId('error-email')).toContainText('valid email');
});
`
