import { expect, test, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('bulk delete confirms a snapshot, handles failure and preserves newer uploads and draft text', async ({
  page,
}) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    return route.continue();
  });
  await page.goto('/');
  await page.getByLabel('Dokumente auswählen').setInputFiles([
    {
      name: 'Sammel-A.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Erste synthetische Quelle.'),
    },
    {
      name: 'Sammel-B.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Zweite synthetische Quelle.'),
    },
  ]);
  await expect(page.getByText('Sammel-B.txt', { exact: true })).toBeVisible();
  await page
    .getByRole('textbox', { name: /^Text oder E-Mail-Verlauf/ })
    .fill('Zusätzliche Notiz bleibt erhalten.');
  await page.getByRole('textbox', { name: /^Prüfauftrag/ }).fill('Lieferung prüfen.');
  await page.getByRole('button', { name: 'Vergleich', exact: true }).click();
  await page.getByRole('button', { name: 'Gespeicherte auswählen' }).click();
  const picker = page.getByRole('dialog', { name: 'Gespeicherte Dokumente' });
  for (const name of ['Sammel-A.txt', 'Sammel-B.txt'])
    await picker.getByRole('checkbox', { name, exact: true }).check();
  await picker.getByRole('button', { name: '2 Dokumente übernehmen' }).click();
  await page.getByRole('button', { name: 'Einstellungen', exact: true }).click();
  const confirmed = (await (await page.request.get('/api/documents')).json()).map(
    (doc: { id: string }) => doc.id,
  );
  const trigger = page.getByRole('button', {
    name: 'Alle gespeicherten Dokumente löschen',
    exact: true,
  });
  await trigger.scrollIntoViewIfNeeded();
  const before = await trigger.boundingBox();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Alle Dokumente löschen?' });
  await expect(dialog).toContainText(`Alle ${confirmed.length} gespeicherten Dokumente`);
  await dialog.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(trigger).toBeFocused();
  expect(await trigger.boundingBox()).toEqual(before);
  expect((await (await page.request.get('/api/documents')).json()).length).toBe(confirmed.length);

  let fail = true;
  let pending: Route | undefined;
  await page.route('**/api/documents', (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    const body = route.request().postDataJSON();
    expect(Object.keys(body)).toEqual(['document_ids']);
    expect([...body.document_ids].sort()).toEqual([...confirmed].sort());
    if (fail) {
      pending = route;
      return;
    }
    return route.continue();
  });
  await trigger.click();
  const confirm = dialog.getByRole('button', { name: 'Endgültig löschen', exact: true });
  const confirmBefore = await confirm.boundingBox();
  await confirm.click();
  await expect(confirm).toBeDisabled();
  await expect.poll(() => !!pending).toBe(true);
  const pendingBoxes = await confirm.evaluate(async (element) => {
    const samples = [];
    for (let frame = 0; frame < 18; frame++) {
      const { x, y, width, height } = element.getBoundingClientRect();
      samples.push({ x, y, width, height });
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return samples;
  });
  for (const box of pendingBoxes) expect(box).toEqual(confirmBefore);
  await pending!.fulfill({
    status: 503,
    json: { detail: 'Offline-Test: Speichern nicht möglich.' },
  });
  await expect(dialog.getByRole('alert')).toContainText('Speichern nicht möglich');
  expect((await (await page.request.get('/api/documents')).json()).length).toBe(confirmed.length);
  const newer = await (
    await page.request.post('/api/documents', {
      multipart: {
        file: {
          name: 'Später.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('Erst nach der Bestätigung hochgeladen.'),
        },
      },
    })
  ).json();
  fail = false;
  await dialog.getByRole('button', { name: 'Endgültig löschen', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeDisabled();
  expect(await (await page.request.get('/api/documents')).json()).toEqual([newer]);
  await page.getByRole('button', { name: 'Neue Analyse', exact: true }).click();
  await expect(page.locator('.document-chip')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Reihenfolge tauschen' })).toBeDisabled();
  await page.getByRole('button', { name: 'Vertrag', exact: true }).click();
  await expect(page.locator('.document-chip')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: /^Text oder E-Mail-Verlauf/ })).toHaveValue(
    'Zusätzliche Notiz bleibt erhalten.',
  );
  await expect(page.getByRole('textbox', { name: /^Prüfauftrag/ })).toHaveValue(
    'Lieferung prüfen.',
  );
  await page.goto('/#settings');
  await page.reload();
  await expect(page.getByText('Später.txt', { exact: true })).toBeVisible();
});

test('bulk delete stays accessible and stationary on desktop and mobile in both themes', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    if (url.pathname === '/api/documents')
      return route.fulfill({
        json: [
          {
            id: 'sample',
            name: 'Korrespondenz.txt',
            text: 'Synthetischer Text',
            char_count: 18,
            page_count: 1,
          },
        ],
      });
    return route.continue();
  });
  await page.goto('/#settings');
  const trigger = page.getByRole('button', {
    name: 'Alle gespeicherten Dokumente löschen',
    exact: true,
  });
  for (const theme of ['Hell', 'Dunkel']) {
    await page.getByRole('radio', { name: theme, exact: true }).check();
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await trigger.scrollIntoViewIfNeeded();
      const before = await trigger.boundingBox();
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Alle Dokumente löschen?' });
      const boxes = await dialog.evaluate(async (element) => {
        const samples = [];
        for (let index = 0; index < 18; index++) {
          const { x, y, width, height } = element.getBoundingClientRect();
          samples.push({ x, y, width, height });
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
        return samples;
      });
      for (const sample of boxes) expect(sample).toEqual(boxes.at(-1));
      await expect(dialog).toHaveCSS('opacity', '1');
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
      await page.screenshot({ path: `artifacts/bulk-delete-${theme}-${width}.png` });
      await page.keyboard.press('Escape');
      await expect(trigger).toBeFocused();
      expect(await trigger.boundingBox()).toEqual(before);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  }
});
