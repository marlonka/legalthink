import { expect, test, type Locator, type Page } from '@playwright/test';

const documents = [
  {
    id: 'layout-a',
    name: 'Ausgang.txt',
    text: 'Vorheriger Absatz. Die Laufzeit beträgt zwölf Monate. Nächster Absatz.',
    page_count: 1,
    char_count: 83,
  },
  {
    id: 'layout-b',
    name: 'Gegenentwurf.txt',
    text: 'Die Laufzeit beträgt sechs Monate.',
    page_count: 1,
    char_count: 33,
  },
];
const analysis = {
  id: 'layout-analysis',
  title: 'Testvertrag',
  workflow: 'contract',
  summary: 'Prüfung der vereinbarten Laufzeiten.',
  findings: [0, 1, 2].map((index) => ({
    id: `finding-${index}`,
    title: `Regelung ${index + 1}`,
    severity: index === 0 ? 'high' : 'medium',
    category: 'Laufzeit',
    description:
      'Die vereinbarte Laufzeit beträgt zwölf Monate. Prüfen Sie, ob die Laufzeit der vertraglichen Vereinbarung entspricht.',
    source_quote: 'Die Laufzeit beträgt zwölf Monate.',
    source_document_id: 'layout-a',
    source_location: '§ 1',
    suggestion: 'Die Laufzeit beträgt sechs Monate.',
    legal_basis: '',
    verified: true,
  })),
  timeline: [],
  questions: [],
  created_at: '2026-10-03T12:00:00Z',
  model: 'Synthetischer Test',
  effort: 'medium',
  is_demo: true,
};

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort('blockedbyclient');
    if (url.pathname === '/api/documents') return route.fulfill({ json: documents });
    if (['/api/analyses', '/api/playbooks'].includes(url.pathname))
      return route.fulfill({ json: [] });
    if (['/api/demo', '/api/analyses/layout-analysis'].includes(url.pathname))
      return route.fulfill({ json: analysis });
    if (url.pathname === '/api/health')
      return route.fulfill({ json: { status: 'ok', api_configured: false } });
    return route.continue();
  });
});

type Box = { x: number; y: number; width: number; height: number };
async function box(locator: Locator): Promise<Box> {
  return locator.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  });
}
function sameBox(actual: Box, expected: Box) {
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    expect(
      Math.abs(actual[key] - expected[key]),
      `${key}: ${actual[key]} vs ${expected[key]}`,
    ).toBeLessThanOrEqual(0.5);
  }
}
async function frames(locator: Locator) {
  return locator.evaluate(async (element) => {
    const result: Box[] = [];
    for (let index = 0; index < 18; index++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const { x, y, width, height } = element.getBoundingClientRect();
      result.push({ x, y, width, height });
    }
    return result;
  });
}
async function ready(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.page-transition')).toHaveCSS('opacity', '1');
  await expect(page.locator('.page-transition')).toHaveCSS('transform', 'none');
}

test('press feedback and dialog entry keep their geometry', async ({ page }) => {
  await page.goto('/#playbooks');
  await ready(page);
  const trigger = page.getByRole('button', { name: 'Playbook erstellen', exact: true });
  await trigger.hover();
  const before = await box(trigger);
  await page.mouse.down();
  const pressed = await frames(trigger);
  await page.mouse.up();
  for (const frame of pressed) sameBox(frame, before);
  const dialog = page.getByRole('dialog', { name: 'Neues Playbook' });
  const opening = await frames(dialog);
  for (const frame of opening) sameBox(frame, opening.at(-1)!);
  sameBox(await box(trigger), before);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  sameBox(await box(trigger), before);
});

test('workspace headings share one stable origin across navigation and scrollbars', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await ready(page);
  const initial = await box(page.getByRole('heading', { level: 1 }));
  for (const name of ['Kanzlei-Playbooks', 'Analysen', 'Einstellungen', 'Neue Analyse']) {
    await page.getByRole('button', { name, exact: true }).click();
    await ready(page);
    const current = await box(page.getByRole('heading', { level: 1 }));
    expect(Math.abs(current.x - initial.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(current.y - initial.y)).toBeLessThanOrEqual(0.5);
  }
});

for (const width of [390, 768, 1280]) {
  test(`composer controls stay anchored across workflow and model choices at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await ready(page);
    const input = page.getByRole('textbox', { name: /^Prüfauftrag/ });
    const toolbar = page.locator('.composer-toolbar');
    const inputBefore = await box(input);
    const toolbarBefore = await box(toolbar);
    for (const name of ['Vergleich', 'Chronologie', 'Datenschutz', 'Werbung', 'Vertrag']) {
      await page.getByRole('button', { name, exact: true }).click();
      for (const frame of await frames(input)) sameBox(frame, inputBefore);
      sameBox(await box(toolbar), toolbarBefore);
    }
    // The source field makes the form taller. Scroll controls into view before
    // measuring their interaction, so intentional scrolling is not a layout shift.
    const options = page.getByRole('button', { name: 'Prüfoptionen', exact: true });
    await options.scrollIntoViewIfNeeded();
    const optionsInputBefore = await box(input);
    const optionsToolbarBefore = await box(toolbar);
    await options.click();
    sameBox(await box(input), optionsInputBefore);
    sameBox(await box(toolbar), optionsToolbarBefore);
    const research = page.getByRole('checkbox', { name: 'Webrecherche einbeziehen' });
    await research.scrollIntoViewIfNeeded();
    const researchBefore = await box(research);
    const playbook = page.getByRole('combobox', { name: 'Kanzlei-Playbook' });
    const playbookBefore = await box(playbook);
    await research.check();
    for (const frame of await frames(research)) sameBox(frame, researchBefore);
    sameBox(await box(playbook), playbookBefore);
    await research.uncheck();
    await page.screenshot({ path: `artifacts/options-${width}.png`, fullPage: true });
    await options.click();
    const picker = page.locator('.model-picker');
    await picker.scrollIntoViewIfNeeded();
    const pickerBefore = await box(picker);
    const modelToolbarBefore = await box(toolbar);
    await page.getByRole('button', { name: 'GPT-6 Luna', exact: true }).click();
    await page.getByRole('button', { name: 'GPT-6.1 Sol', exact: true }).click();
    sameBox(await box(picker), pickerBefore);
    await page.getByRole('button', { name: 'Denkaufwand: Hoch' }).click();
    const slider = page.getByRole('slider', { name: 'Denkaufwand' });
    await slider.focus();
    for (const key of ['Home', 'End', 'Home', 'ArrowRight']) {
      await page.keyboard.press(key);
      sameBox(await box(picker), pickerBefore);
      sameBox(await box(toolbar), modelToolbarBefore);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 620 },
]) {
  test(`document selection and search preserve dialog geometry at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await ready(page);
    await page.getByRole('button', { name: 'Vergleich', exact: true }).click();
    await page.getByRole('button', { name: 'Gespeicherte auswählen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Gespeicherte Dokumente' });
    await expect(dialog).toHaveCSS('opacity', '1');
    const row = dialog.getByRole('checkbox', { name: 'Ausgang.txt' });
    await row.scrollIntoViewIfNeeded();
    const initial = await box(row);
    const dialogBefore = await box(dialog);
    const footer = dialog.locator('.modal-footer');
    const footerBefore = await box(footer);
    await row.check();
    for (const frame of await frames(row)) sameBox(frame, initial);
    sameBox(await box(dialog), dialogBefore);
    sameBox(await box(footer), footerBefore);
    await row.uncheck();
    for (const frame of await frames(row)) sameBox(frame, initial);
    const search = dialog.getByRole('textbox', { name: 'Gespeicherte Dokumente durchsuchen' });
    await search.scrollIntoViewIfNeeded();
    const searchBefore = await box(search);
    const searchDialogBefore = await box(dialog);
    const searchFooterBefore = await box(footer);
    for (const term of ['Ausgang', 'Keine Treffer']) {
      await search.fill(term);
      for (const frame of await frames(search)) sameBox(frame, searchBefore);
      sameBox(await box(dialog), searchDialogBefore);
      sameBox(await box(footer), searchFooterBefore);
    }
    await expect(dialog.getByText('Keine Dokumente gefunden', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Dokumentsuche zurücksetzen' }).click();
    sameBox(await box(search), searchBefore);
    sameBox(await box(dialog), searchDialogBefore);
    sameBox(await box(footer), searchFooterBefore);
    await expect(search).toBeFocused();
    await expect(row).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('finding selection, checked labels and source disclosures retain their triggers', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Beispiel öffnen' }).click();
  await expect(page.getByRole('heading', { name: 'Testvertrag' })).toBeVisible();
  await ready(page);
  const first = page.locator('.finding-heading').nth(0);
  const second = page.locator('.finding-heading').nth(1);
  await second.scrollIntoViewIfNeeded();
  const before = await box(second);
  await second.click();
  for (const frame of await frames(second)) sameBox(frame, before);
  await expect(first).toHaveAttribute('aria-expanded', 'true');
  const context = page.getByRole('button', { name: 'Kontext anzeigen', exact: true });
  await context.scrollIntoViewIfNeeded();
  const contextBefore = await box(context);
  await context.click();
  sameBox(
    await box(page.getByRole('button', { name: 'Kontext ausblenden', exact: true })),
    contextBefore,
  );
  await page.getByRole('tab', { name: /Formulierungen/ }).click();
  const mark = page.getByRole('button', { name: 'Als geprüft markieren', exact: true }).first();
  await mark.scrollIntoViewIfNeeded();
  const markBefore = await box(mark);
  await mark.click();
  const marked = page.getByRole('button', { name: 'Geprüft', exact: true });
  for (const frame of await frames(marked)) sameBox(frame, markBefore);
});
