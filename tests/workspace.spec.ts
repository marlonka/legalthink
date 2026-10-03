import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function assertAccessible(page: Page) {
  // Audit the settled UI: alpha blending during a fade is not its final contrast.
  for (const surface of await page
    .locator(
      '.page-transition, .modal, .finding-content-motion, .picker-popover, .export-popover, .review-workspace, .finding-list, #source-panel > div, .timeline-panel',
    )
    .filter({ visible: true })
    .all()) {
    await expect(surface).toHaveCSS('opacity', '1');
  }
  const audit = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(
    audit.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
    })),
  ).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) await route.continue();
    else await route.abort('blockedbyclient');
  });
});

test('start page is usable, self-contained and accessible', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Neue Analyse', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Beispiel öffnen' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'API einrichten' })).toBeVisible();
  await assertAccessible(page);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/start-desktop.png', fullPage: true });
});

test('model selection resets an incompatible reasoning effort', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'GPT-6.1 Sol', exact: true }).click();
  await page.getByRole('button', { name: 'GPT-6 Luna', exact: true }).click();
  await page.getByRole('button', { name: 'Denkaufwand: Mittel' }).click();
  const slider = page.getByRole('slider', { name: 'Denkaufwand' });
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Ohne');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Denkaufwand: Ohne' })).toBeVisible();
  await page.getByRole('button', { name: 'GPT-6 Luna', exact: true }).click();
  await page.getByRole('button', { name: 'GPT-6.1 Sol', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Denkaufwand: Mittel' })).toBeVisible();
  await page.getByRole('button', { name: 'Denkaufwand: Mittel' }).click();
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Niedrig');
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Mittel');
  await assertAccessible(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Denkaufwand: Mittel' })).toBeFocused();
});

test('appearance persists and follows the OS only when System is selected', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/#settings');
  await expect(page.getByRole('radio', { name: 'Dunkel', exact: true })).toBeChecked();
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await page.getByRole('radio', { name: 'Hell', exact: true }).check();
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Hell', exact: true })).toBeChecked();
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await page.getByRole('radio', { name: 'System', exact: true }).check();
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await page.getByRole('radio', { name: 'System', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Hell', exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Hell', exact: true })).toBeFocused();
});

test('appearance remains usable when browser storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
    Storage.prototype.setItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
  });
  await page.goto('/#settings');
  await expect(page.getByRole('radio', { name: 'Dunkel', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Hell', exact: true }).check();
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await page.getByRole('button', { name: 'Neue Analyse', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Neue Analyse', exact: true })).toBeVisible();
});

for (const theme of ['Dunkel', 'Hell'] as const) {
  test(`${theme} theme: settings, menus, review and mobile remain readable`, async ({ page }) => {
    test.setTimeout(60_000);
    const name = theme === 'Dunkel' ? 'dark' : 'light';
    await page.setViewportSize(
      theme === 'Dunkel' ? { width: 1233, height: 1017 } : { width: 1242, height: 1061 },
    );
    await page.goto('/#settings');
    await page.getByRole('radio', { name: theme, exact: true }).check();
    await page
      .getByRole('heading', { name: 'Einstellungen', exact: true })
      .scrollIntoViewIfNeeded();
    await assertAccessible(page);
    await page.screenshot({ path: `artifacts/settings-${name}.png` });
    await page.getByRole('button', { name: 'Neue Analyse', exact: true }).click();
    await assertAccessible(page);
    await page.screenshot({ path: `artifacts/start-${name}.png` });
    await page.getByRole('button', { name: 'Denkaufwand: Mittel' }).click();
    await expect(page.getByRole('slider', { name: 'Denkaufwand' })).toBeVisible();
    await assertAccessible(page);
    await page.screenshot({ path: `artifacts/effort-${name}.png` });
    await page
      .locator('.effort-popover')
      .screenshot({ path: `artifacts/effort-${name}-detail.png` });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Beispiel öffnen' }).click();
    await expect(
      page.getByRole('heading', { name: 'Cloud-Vertrag · Beispielprüfung' }),
    ).toBeVisible();
    await assertAccessible(page);
    await page.screenshot({ path: `artifacts/review-${name}.png` });
    await page.getByRole('tab', { name: /Formulierungen/ }).click();
    await assertAccessible(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Navigation öffnen', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Hauptnavigation' })
      .getByRole('button', { name: 'Neue Analyse', exact: true })
      .click();
    await assertAccessible(page);
    await page.screenshot({ path: `artifacts/mobile-${name}.png` });
    for (const width of [320, 390, 568, 768, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      const runButton = page.getByRole('button', { name: 'Analyse starten', exact: true });
      await runButton.scrollIntoViewIfNeeded();
      await expect(runButton).toBeInViewport();
      await page.getByRole('button', { name: 'Denkaufwand: Mittel', exact: true }).click();
      await expect(page.locator('.effort-popover')).toBeInViewport({ ratio: 1 });
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'GPT-6.1 Sol', exact: true }).click();
      await expect(page.locator('.picker-popover')).toBeInViewport({ ratio: 1 });
      await page.keyboard.press('Escape');
    }
  });
}

test('upload stays local and unavailable AI produces a recoverable error', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Dokumente auswählen').setInputFiles({
    name: 'Lokaler-Testvertrag.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(
      'Fiktiver Testvertrag. § 1 Leistung: Bereitstellung einer Software. § 2 Vergütung: monatlich 200 EUR. § 3 Kündigung: jederzeit zum Monatsende.',
    ),
  });
  await expect(page.getByText('Lokaler-Testvertrag.txt', { exact: true })).toBeVisible();
  await page.getByLabel(/^Prüfauftrag/).fill('Aus Sicht des Auftraggebers prüfen.');
  await page.getByRole('button', { name: 'Analyse starten', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/API|Schlüssel|konfiguriert/i);
  await expect(page.getByLabel(/^Prüfauftrag/)).toHaveValue('Aus Sicht des Auftraggebers prüfen.');
});

test('mobile layout fits and respects reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Neue Analyse', exact: true })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  await assertAccessible(page);
  await page.screenshot({ path: 'artifacts/start-mobile.png', fullPage: true });
});

test('example connects findings, evidence, proposals, export and persistent history', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Beispiel öffnen' }).click();
  await expect(
    page.getByRole('heading', { name: 'Cloud-Vertrag · Beispielprüfung' }),
  ).toBeVisible();
  await expect(page.getByText(/Fiktive Unterlagen mit vorgegebenen Ergebnissen/)).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Quellenansicht' })).toContainText(
    'Haftung',
  );
  await assertAccessible(page);
  await page.screenshot({ path: 'artifacts/review-desktop.png', fullPage: true });
  await page.getByRole('tab', { name: /Formulierungen/ }).click();
  await expect(page.getByText('AUSGANGSTEXT').first()).toBeVisible();
  await expect(page.getByText('VORSCHLAG', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Als geprüft markieren' }).first().click();
  await expect(page.getByRole('button', { name: 'Geprüft', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Exportieren' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Word-Dokument/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.docx$/);
  expect(await file.failure()).toBeNull();
  await file.saveAs('artifacts/example-review.docx');
  const analysisUrl = page.url();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Cloud-Vertrag · Beispielprüfung' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /^Analysen/ }).click();
  await expect(page.getByRole('heading', { name: 'Analysen', exact: true })).toBeVisible();
  await page
    .locator('.history-item-main')
    .filter({ hasText: 'Cloud-Vertrag · Beispielprüfung' })
    .first()
    .click();
  await expect(page).toHaveURL(analysisUrl);
});

test('playbook is saved, edited, available to an analysis and explicitly deleted', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Kanzlei-Playbooks', exact: true }).click();
  await page.getByRole('button', { name: 'Playbook erstellen', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Neues Playbook' });
  await dialog.getByLabel('Name', { exact: true }).fill('Offline-Prüfstandard');
  await dialog
    .getByLabel('Prüfvorgaben')
    .fill('Aus Auftraggebersicht prüfen. Fehlende Anlagen als offene Fragen kennzeichnen.');
  await assertAccessible(page);
  await dialog.getByRole('button', { name: 'Playbook speichern' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Offline-Prüfstandard' })).toBeVisible();
  await page.getByRole('button', { name: /Offline-Prüfstandard.*Aus Auftraggebersicht/ }).click();
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Playbook bearbeiten' });
  await editor
    .getByLabel('Prüfvorgaben')
    .fill('Geänderte Vorgabe: Kündigungsfristen gesondert prüfen.');
  await editor.getByRole('button', { name: 'Playbook speichern' }).click();
  await expect(editor).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText('Geänderte Vorgabe: Kündigungsfristen gesondert prüfen.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Neue Analyse', exact: true }).click();
  await page.getByRole('button', { name: 'Prüfoptionen' }).click();
  await page
    .getByRole('combobox', { name: 'Kanzlei-Playbook', exact: true })
    .selectOption({ label: 'Offline-Prüfstandard' });
  await page.getByRole('button', { name: 'Prüfoptionen' }).click();
  await expect(page.getByText('Playbook: Offline-Prüfstandard', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Kanzlei-Playbooks', exact: true }).click();
  await page.getByRole('button', { name: 'Offline-Prüfstandard löschen' }).click();
  await expect(page.getByRole('dialog', { name: 'Playbook löschen?' })).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Offline-Prüfstandard' })).toBeVisible();
  await page.getByRole('button', { name: 'Offline-Prüfstandard löschen' }).click();
  await page.getByRole('button', { name: 'Endgültig löschen' }).click();
  await expect(page.getByRole('heading', { name: 'Offline-Prüfstandard' })).toHaveCount(0);
});

test('stored documents survive reload and comparison preserves the chosen order', async ({
  page,
}) => {
  await page.route('**/api/health', (route) =>
    route.fulfill({ json: { status: 'ok', api_configured: true } }),
  );
  await page.goto('/');
  await page.getByLabel('Dokumente auswählen').setInputFiles([
    {
      name: 'Fassung-A.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Fiktiver Ausgangsentwurf. Die Vertragslaufzeit beträgt zwölf Monate.'),
    },
    {
      name: 'Fassung-B.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Fiktiver Gegenentwurf. Die Vertragslaufzeit beträgt sechs Monate.'),
    },
  ]);
  await expect(page.getByText('Fassung-B.txt', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Vergleich', exact: true }).click();
  await page.getByRole('button', { name: 'Gespeicherte auswählen' }).click();
  const picker = page.getByRole('dialog', { name: 'Gespeicherte Dokumente' });
  await picker.getByRole('checkbox', { name: /Fassung-A.txt/ }).check();
  await picker.getByRole('checkbox', { name: /Fassung-B.txt/ }).check();
  await picker.getByRole('button', { name: '2 Dokumente übernehmen' }).click();
  await expect(picker).toHaveCount(0);
  await page.getByRole('button', { name: 'Reihenfolge tauschen' }).click();
  await expect(page.locator('.document-chip').first()).toContainText('Fassung-B.txt');
  await expect(page.locator('.document-chip').first()).toContainText('Original');
  let sent: { workflow: string; document_ids: string[] } | undefined;
  await page.route('**/api/analyses', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    sent = route.request().postDataJSON();
    await route.fulfill({ status: 503, json: { detail: 'Offline-Test: Prüfauftrag erfasst.' } });
  });
  await page.getByRole('button', { name: 'Analyse starten', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Offline-Test: Prüfauftrag erfasst.');
  expect(sent?.workflow).toBe('compare');
  const documents = await (await page.request.get('/api/documents')).json();
  expect(
    sent?.document_ids.map(
      (id) => documents.find((document: { id: string }) => document.id === id).name,
    ),
  ).toEqual(['Fassung-B.txt', 'Fassung-A.txt']);
  await page.getByRole('button', { name: 'Fassung-B.txt aus Auswahl entfernen' }).click();
  const remaining = page.getByRole('button', { name: 'Fassung-A.txt aus Auswahl entfernen' });
  await expect(remaining).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel(/^Prüfauftrag/)).toBeFocused();
});

test('failed initial data load can be retried without presenting an empty workspace as success', async ({
  page,
}) => {
  let fail = true;
  await page.route('**/api/analyses', (route) =>
    fail
      ? route.fulfill({ status: 503, json: { detail: 'Offline-Test: Verlauf nicht verfügbar.' } })
      : route.continue(),
  );
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Erneut laden' })).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Erneut laden' }).click();
  await expect(page.getByRole('button', { name: 'Erneut laden' })).toHaveCount(0);
});

test('mobile navigation contains focus and restores the menu trigger', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Navigation öffnen' });
  await trigger.click();
  const drawer = page.getByRole('dialog', { name: 'Hauptnavigation' });
  await expect(drawer).toBeVisible();
  for (let index = 0; index < 18; index++) {
    await page.keyboard.press('Tab');
    expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
