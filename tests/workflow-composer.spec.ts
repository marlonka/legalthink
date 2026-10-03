import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const scenarios = [
  { id: 'contract', label: 'Vertrag', title: 'Cloud-Vertrag · Beispielprüfung' },
  { id: 'compare', label: 'Vergleich', title: 'Cloud-Vertrag · Versionsvergleich' },
  { id: 'chronology', label: 'Chronologie', title: 'Rechnerlieferung · Chronologie' },
  { id: 'compliance', label: 'Datenschutz', title: 'Kundenportal · Datenschutzprüfung' },
  { id: 'avv', label: 'Datenschutz', title: 'Auftragsverarbeitung · AVV-Prüfung' },
  { id: 'dsfa', label: 'Datenschutz', title: 'Videoanalyse · DSFA-Vorbereitung' },
  { id: 'advertising', label: 'Werbung', title: 'Reinigungsmittel · Werbeprüfung' },
];

async function choose(page: Page, scenario: (typeof scenarios)[number]) {
  await page.getByRole('button', { name: scenario.label, exact: true }).click();
  if (scenario.label === 'Datenschutz')
    await page
      .getByRole('combobox', { name: 'Datenschutz-Aufgabe' })
      .selectOption(scenario.id === 'compliance' ? 'general' : scenario.id);
}
test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) =>
    ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort('blockedbyclient'),
  );
});

test('each task opens its own example without overwriting the user draft', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  const analysisIds = new Set<string>();
  const input = page.getByLabel(/^Prüfauftrag/);
  for (const [index, scenario] of scenarios.entries()) {
    await choose(page, scenario);
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', /^z\. B\./);
    await expect(page.locator('.page-transition')).toHaveCSS('opacity', '1');
    await page.screenshot({
      path: `artifacts/workflow-audit/${index + 1}-${scenario.id}-start.png`,
      fullPage: true,
    });
    await input.fill(`Eigener Prüfauftrag für ${scenario.id}.`);
    await page.getByRole('button', { name: 'Beispiel öffnen' }).click();
    await expect(page.getByRole('heading', { name: scenario.title, exact: true })).toBeVisible();
    const id = page.url().split('analysis/')[1];
    analysisIds.add(id);
    const saved = await (await page.request.get(`/api/analyses/${id}`)).json();
    expect(saved.demo_scenario).toBe(scenario.id);
    expect(saved.document_ids.length).toBeGreaterThan(0);
    expect(saved.is_demo).toBe(true);
    if (scenario.id === 'chronology')
      await expect(page.getByRole('tab', { name: /Chronologie/ })).toHaveAttribute(
        'aria-selected',
        'true',
      );
    await expect(page.locator('.page-transition')).toHaveCSS('opacity', '1');
    await page.screenshot({
      path: `artifacts/workflow-audit/${index + 1}-${scenario.id}-result.png`,
      fullPage: true,
    });
    await page.getByRole('main').getByRole('button', { name: 'Neue Analyse', exact: true }).click();
    await expect(input).toHaveValue(`Eigener Prüfauftrag für ${scenario.id}.`);
    await expect(page.locator('.uploaded-documents')).toHaveCount(0);
  }
  expect(analysisIds.size).toBe(7);
  for (const scenario of scenarios) {
    await choose(page, scenario);
    await expect(input).toHaveValue(`Eigener Prüfauftrag für ${scenario.id}.`);
  }
});

test('AVV and DSFA keep separate documents and options and submit the explicit task', async ({
  page,
}) => {
  await page.route('**/api/health', (route) =>
    route.fulfill({ json: { status: 'ok', api_configured: true } }),
  );
  await page.goto('/');
  await choose(page, scenarios[4]);
  await page.getByLabel('Dokumente auswählen').setInputFiles({
    name: 'Eigene-AVV.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      'Fiktives Testdokument zur Auftragsverarbeitung. Nur zur lokalen Bedienprüfung.',
    ),
  });
  await expect(page.getByText('Eigene-AVV.txt', { exact: true })).toBeVisible();
  await page.getByLabel(/^Prüfauftrag/).fill('Wir vertreten den Dienstleister.');
  await page.getByRole('button', { name: 'Prüfoptionen' }).click();
  await page.getByRole('checkbox', { name: 'Webrecherche einbeziehen' }).check();
  await choose(page, scenarios[5]);
  await expect(page.getByLabel(/^Prüfauftrag/)).toHaveValue('');
  await expect(page.locator('.uploaded-documents')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Webrecherche einbeziehen' })).not.toBeChecked();
  await choose(page, scenarios[4]);
  await expect(page.getByLabel(/^Prüfauftrag/)).toHaveValue('Wir vertreten den Dienstleister.');
  await expect(page.getByText('Eigene-AVV.txt', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Webrecherche einbeziehen' })).toBeChecked();
  let sent: Record<string, unknown> | undefined;
  await page.route('**/api/analyses', (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    sent = route.request().postDataJSON();
    return route.fulfill({ status: 503, json: { detail: 'Offline-Test: Auftrag erfasst.' } });
  });
  await page.getByRole('button', { name: 'Analyse starten', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Offline-Test: Auftrag erfasst.');
  expect(sent).toMatchObject({
    workflow: 'compliance',
    compliance_task: 'avv',
    context: 'Wir vertreten den Dienstleister.',
    model: 'gpt-6-luna',
    effort: 'high',
    research: true,
  });
});

test('comparison rejects an oversized batch before uploading documents', async ({ page }) => {
  let uploads = 0;
  await page.route('**/api/documents', (route) => {
    if (route.request().method() === 'POST') {
      uploads++;
      return route.fulfill({ status: 500 });
    }
    return route.continue();
  });
  await page.goto('/');
  await choose(page, scenarios[1]);
  await page.getByLabel('Dokumente auswählen').setInputFiles(
    [1, 2, 3].map((index) => ({
      name: `Fassung-${index}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from('Nur fiktiver Text für einen lokalen Test.'),
    })),
  );
  await expect(page.getByRole('alert')).toContainText('genau zwei Fassungen');
  expect(uploads).toBe(0);
});

test('privacy task selection stays accessible and fits narrow screens in both themes', async ({
  page,
}) => {
  test.setTimeout(60_000);
  for (const theme of ['Hell', 'Dunkel']) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#settings');
    await page.getByRole('radio', { name: theme, exact: true }).check();
    await page.goto('/#new');
    await choose(page, scenarios[5]);
    await expect(page.locator('.page-transition')).toHaveCSS('opacity', '1');
    await page.getByRole('button', { name: 'Prüfoptionen' }).click();
    await expect(page.locator('#analysis-options')).toHaveCSS('opacity', '1');
    await page.screenshot({
      path: `artifacts/workflow-audit/dsfa-mobile-${theme}.png`,
      fullPage: true,
    });
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(audit.violations).toEqual([]);
    for (const width of [320, 390, 700, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      await expect(page.getByRole('combobox', { name: 'Datenschutz-Aufgabe' })).toBeVisible();
    }
  }
});
