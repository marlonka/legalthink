import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) await route.continue();
    else await route.abort('blockedbyclient');
  });
});

async function openExample(page: Page, scenario: 'compare' | 'chronology') {
  // The configured server uses isolated storage and an empty provider key.
  const response = await page.request.post('/api/demo', { data: { scenario } });
  expect(response.status()).toBe(201);
  const analysis: { id: string } = await response.json();
  await page.goto(`/#analysis/${analysis.id}`);
}

test('a finding opens its matching proposal and manual tabs do not repeat that navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await openExample(page, 'compare');

  const title = 'Exportfenster von 30 auf sieben Tage verkürzt';
  const findings = page.getByRole('tabpanel', { name: /Befunde/ });
  const finding = findings.getByRole('article').filter({ hasText: title });
  await finding.getByRole('button', { name: new RegExp(title) }).click();
  await finding.getByRole('button', { name: 'Formulierung', exact: true }).click();

  const proposals = page.getByRole('tabpanel', { name: /Formulierungen/ });
  const matchingProposal = proposals.getByRole('button', { name: new RegExp(title) });
  await expect(matchingProposal).toBeFocused();
  await expect(matchingProposal).toBeInViewport({ ratio: 1 });

  await page.getByRole('tab', { name: /Befunde/ }).click();
  const proposalTab = page.getByRole('tab', { name: /Formulierungen/ });
  await proposalTab.click();
  const focusStaysOnTab = await proposalTab.evaluate(async (element) => {
    for (let frame = 0; frame < 8; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (document.activeElement !== element) return false;
    }
    return true;
  });
  expect(focusStaysOnTab).toBe(true);
  await expect(proposalTab).toBeInViewport({ ratio: 1 });
});

test('a chronology event opens its own document context and returns focus to the event', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openExample(page, 'chronology');

  const event = page.getByRole('row').filter({ hasText: 'Kunde meldet ausstehende Lieferung' });
  const sourceAction = event.getByRole('button', { name: 'Fundstelle ansehen', exact: true });
  await sourceAction.click();

  const source = page.getByRole('complementary', { name: 'Quellenansicht' });
  await expect(source).toBeFocused();
  await expect(
    source.getByText('Beispiel · 02 E-Mail zum Lieferstand.txt', { exact: true }),
  ).toBeVisible();
  await expect(source.getByRole('blockquote')).toContainText(
    'Am 17.09.2026 teilte der Kunde mit, dass noch kein Rechner eingetroffen sei.',
  );
  await source.getByRole('button', { name: 'Kontext anzeigen', exact: true }).click();
  await expect(source.getByText(/E-Mail des Kunden vom 17\.09\.2026/)).toBeVisible();

  await source.getByRole('button', { name: 'Quellenansicht schließen' }).click();
  await expect(source).toHaveCount(0);
  await expect(sourceAction).toBeFocused();
  await expect(sourceAction).toBeInViewport({ ratio: 1 });
});

test('comparison results preserve the original and counterproposal identity after reload', async ({
  page,
}) => {
  await openExample(page, 'compare');

  const pair = page.locator('dl[aria-label="Vergleichsdokumente"]');
  const original = pair.getByText('Original', { exact: true }).locator('..');
  const counterproposal = pair.getByText('Gegenentwurf', { exact: true }).locator('..');
  for (const reload of [false, true]) {
    if (reload) await page.reload();
    await expect(original).toContainText('Beispiel · 01 Originalentwurf.txt');
    await expect(counterproposal).toContainText('Beispiel · 02 Gegenentwurf.txt');
  }
});
