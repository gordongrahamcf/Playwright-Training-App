export const SCENARIO_1 = `
test('sorts table ascending then descending by name', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/tables');

  await page.getByTestId('col-header-name').click();
  await expect(page.getByTestId('table-row').first()).toContainText('Alice Chen');

  await page.getByTestId('col-header-name').click();
  await expect(page.getByTestId('table-row').first()).toContainText('Zara Williams');
});
`

export const SCENARIO_2 = `
test('filters rows to only matching department', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/tables');

  await page.getByTestId('table-filter-input').fill('HR');

  const rows = page.getByTestId('table-row');
  await expect(rows).toHaveCount(4);

  for (const row of await rows.all()) {
    await expect(row).toContainText('HR');
  }

  await expect(page.getByTestId('pagination-info')).toContainText('1\u20134 of 4');
});
`

export const SCENARIO_3 = `
test('navigates pages and updates info text', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/tables');

  await expect(page.getByTestId('pagination-info')).toContainText('1\u20135 of 20');
  await expect(page.getByTestId('pagination-prev')).toBeDisabled();

  await page.getByTestId('pagination-next').click();
  await expect(page.getByTestId('pagination-info')).toContainText('6\u201310 of 20');
  await expect(page.getByTestId('pagination-prev')).not.toBeDisabled();

  await page.getByTestId('pagination-prev').click();
  await expect(page.getByTestId('pagination-info')).toContainText('1\u20135 of 20');
});
`

export const SCENARIO_4 = `
test('tracks selected row count', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/tables');

  await expect(page.getByTestId('selected-count')).toContainText('0 selected');

  await page.getByTestId('row-checkbox').first().check();
  await expect(page.getByTestId('selected-count')).toContainText('1 selected');

  await page.getByTestId('row-checkbox').nth(2).check();
  await expect(page.getByTestId('selected-count')).toContainText('2 selected');

  await page.getByTestId('row-checkbox').first().uncheck();
  await expect(page.getByTestId('selected-count')).toContainText('1 selected');
});
`

export const SCENARIO_5 = `
test('select-all checks all visible rows and updates count', async ({ page }) => {
  await page.goto('http://localhost:5173/#/exercises/tables');

  await page.getByTestId('select-all-checkbox').check();

  const checkboxes = page.getByTestId('row-checkbox');
  await expect(checkboxes).toHaveCount(5);

  for (const cb of await checkboxes.all()) {
    await expect(cb).toBeChecked();
  }

  await expect(page.getByTestId('selected-count')).toContainText('5 selected');
});
`
