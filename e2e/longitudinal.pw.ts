import { test, expect } from '@playwright/test';

test('longitudinal screen renders', async ({ page }) => {
  await page.goto('/longitudinal');
  await expect(page.getByText(/Longitudinal|paciente|historial/i)).toBeVisible();
});
