import { expect, test } from '@playwright/test';

test('homepage renders the specimen ledger', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toContainText('recommend');
	await expect(page.locator('.answers li').first()).toBeVisible();
});

test('archive is reachable from the masthead', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('link', { name: /The Archive/ }).click();
	await expect(page).toHaveURL(/\/archive$/);
});
