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
  await expect(page.getByRole('button', { name: 'Denkaufwand: Sehr hoch' })).toBeVisible();
  const instruction = page.getByRole('textbox', { name: 'Prüfauftrag (optional)' });
  const customInstruction = '  Eigener Prüfauftrag\nOriginaltext erhalten  ';
  await instruction.fill(customInstruction);
  await page.getByRole('button', { name: 'Vorlage ansehen' }).click();
  await page.getByRole('button', { name: 'Vorlage ergänzen' }).click();
  await expect(instruction).toHaveValue(new RegExp(`^${customInstruction}\n\n\\S`));
  const extendedInstruction = await instruction.inputValue();
  await page.getByRole('button', { name: 'Chronologie', exact: true }).click();
  await page.getByRole('button', { name: 'Vertrag', exact: true }).click();
  await expect(instruction).toHaveValue(extendedInstruction);
  await instruction.fill('');
  await page.getByRole('button', { name: 'Chronologie', exact: true }).click();
  await page.getByRole('button', { name: 'Vertrag', exact: true }).click();
  await expect(instruction).toHaveValue('');
  await page.getByRole('button', { name: /^Beispiel öffnen/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Cloud-Vertrag · Beispielprüfung' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Fundstelle ansehen', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /^Dokumentvorschau:/ })).toContainText(
    'Zitat im Dokument gefunden',
  );
  await expect(page.getByRole('dialog').locator('mark')).toBeVisible();
  await page.getByRole('button', { name: 'Dokumentvorschau schließen', exact: true }).click();
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
  await page.getByRole('button', { name: /^Analysen/ }).click();
  await page.getByRole('button', { name: 'Cloud-Vertrag · Beispielprüfung löschen' }).click();
  await page.getByRole('button', { name: 'Endgültig löschen' }).click();
  await expect(page.getByRole('dialog', { name: 'Analyse löschen?' })).toBeHidden();
  await page.goBack();
  await expect(page.getByRole('alert')).toHaveText('Analyse nicht gefunden.');
  await expect(page.getByRole('heading', { name: 'Cloud-Vertrag · Beispielprüfung' })).toBeHidden();
  expect(errors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test('comparison sends selected versions and context to the local API', async ({ page }) => {
  const uploads: { id: string; name: string }[] = [];
  const externalRequests: string[] = [];
  page.on('response', async (response) => {
    if (response.url().endsWith('/api/documents') && response.request().method() === 'POST') {
      uploads.push(await response.json());
    }
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1') {
      externalRequests.push(url.href);
      await route.abort();
    } else if (url.pathname === '/api/health') {
      // Enable the form; the actual server still has no API key.
      await route.fulfill({
        json: { status: 'ok', api_configured: true, default_processing_region: 'global' },
      });
    } else {
      await route.continue();
    }
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Vergleich', exact: true }).click();
  await page.getByLabel('Dokumente auswählen').setInputFiles([
    { name: 'Original.txt', mimeType: 'text/plain', buffer: Buffer.from('Originaltext.') },
    { name: 'Gegenentwurf.txt', mimeType: 'text/plain', buffer: Buffer.from('Gegenentwurf.') },
  ]);
  await expect(page.getByRole('button', { name: 'Original.txt', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gegenentwurf.txt', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: /Zusätzlicher Kontext/ }).fill('Ergänzende Nachricht.');
  await page.getByRole('textbox', { name: 'Prüfauftrag (optional)' }).fill('Haftung vergleichen.');
  await page.getByRole('button', { name: 'Webrecherche' }).click();
  await expect(page.getByRole('button', { name: 'Webrecherche' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  const analysisResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/analyses') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Analyse starten' }).click();
  const response = await analysisResponse;
  expect(response.status()).toBe(503);
  expect(uploads.map((document) => document.name)).toEqual(['Original.txt', 'Gegenentwurf.txt']);
  expect(response.request().postDataJSON()).toMatchObject({
    workflow: 'compare',
    document_ids: uploads.map((document) => document.id),
    source_text: 'Ergänzende Nachricht.',
    context: 'Haftung vergleichen.',
    research: false,
  });
  await expect(page.getByRole('alert')).toContainText('OpenAI ist noch nicht eingerichtet');
  expect(externalRequests).toEqual([]);
});
