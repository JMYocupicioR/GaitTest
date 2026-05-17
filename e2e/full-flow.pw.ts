import { test, expect } from '@playwright/test';

test('full flow basic navigation works', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Analiza la marcha en minutos')).toBeVisible();
  await page.goto('/calibration');
  await expect(page.getByText('Define tu referencia')).toBeVisible();
  await page.goto('/capture');
  await expect(page.getByText('Graba la marcha')).toBeVisible();
});
