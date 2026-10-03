import { test, expect } from '@playwright/test';

test('Python serves the built workspace with local assets, CSP and working exports', async ({
  page,
}) => {
  const errors: string[] = [];
  const externalRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).hostname === '127.0.0.1') await route.continue();
    else {
      externalRequests.push(route.request().url());
      await route.abort();
    }
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      throw new Error(`CSP violation: ${event.violatedDirective}`);
    });
  });
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");
  await expect(page.getByRole('heading', { name: 'Neue Analyse', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'GPT-6 Luna', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Denkaufwand: Hoch' })).toBeVisible();
  await page.getByRole('button', { name: /^Beispiel öffnen/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Cloud-Vertrag · Beispielprüfung' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Fundstelle ansehen', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Quellenansicht' })).toContainText(
    'Zitat im Dokument gefunden',
  );
  await page.getByRole('button', { name: 'Dialog schließen', exact: true }).click();
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: /Markdown/ }).click();
  const download = await downloading;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(/\.md$/);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Cloud-Vertrag · Beispielprüfung' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});
