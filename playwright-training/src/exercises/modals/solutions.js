export const SCENARIO_1 = `
test('confirms deletion through modal', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/modals');

  await expect(page.getByTestId('confirmation-modal')).not.toBeVisible();

  await page.getByTestId('btn-delete-account').click();
  await expect(page.getByTestId('confirmation-modal')).toBeVisible();
  await expect(page.getByTestId('modal-message')).toContainText('Are you sure');

  await page.getByTestId('modal-confirm').click();

  await expect(page.getByTestId('confirmation-modal')).not.toBeVisible();
  await expect(page.getByTestId('delete-success-message')).toBeVisible();
  await expect(page.getByTestId('btn-delete-account')).not.toBeVisible();
});
`

export const SCENARIO_2 = `
test('cancels deletion and closes modal without side effects', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/modals');

  await page.getByTestId('btn-delete-account').click();
  await expect(page.getByTestId('confirmation-modal')).toBeVisible();

  await page.getByTestId('modal-cancel').click();

  await expect(page.getByTestId('confirmation-modal')).not.toBeVisible();
  await expect(page.getByTestId('delete-success-message')).not.toBeVisible();
  await expect(page.getByTestId('btn-delete-account')).toBeVisible();
});
`

export const SCENARIO_3 = `
test('tooltip appears on hover and disappears on mouse-out', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/modals');

  await expect(page.getByTestId('tooltip-content')).not.toBeVisible();

  await page.getByTestId('tooltip-trigger').hover();
  await expect(page.getByTestId('tooltip-content')).toBeVisible();

  await page.mouse.move(0, 0);
  await expect(page.getByTestId('tooltip-content')).not.toBeVisible();
});
`

export const SCENARIO_4 = `
test('opens and closes side drawer via button', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/modals');

  await expect(page.getByTestId('drawer')).not.toBeVisible();

  await page.getByTestId('btn-open-drawer').click();
  await expect(page.getByTestId('drawer')).toBeVisible();
  await expect(page.getByTestId('drawer-content')).toBeVisible();

  await page.getByTestId('drawer-close').click();
  await expect(page.getByTestId('drawer')).not.toBeVisible();
});
`

export const SCENARIO_5 = `
test('closes drawer by clicking the backdrop', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/modals');

  await page.getByTestId('btn-open-drawer').click();
  await expect(page.getByTestId('drawer')).toBeVisible();

  await page.getByTestId('drawer-backdrop').click();
  await expect(page.getByTestId('drawer')).not.toBeVisible();
});
`
