import { expect, test, type Page, type Route } from '@playwright/test';

const tasks = [
  { workflow: 'contract', label: 'Vertrag', task: 'general' },
  { workflow: 'compare', label: 'Vergleich', task: 'general' },
  { workflow: 'chronology', label: 'Chronologie', task: 'general' },
  { workflow: 'compliance', label: 'Datenschutz', task: 'general' },
  { workflow: 'compliance', label: 'Datenschutz', task: 'avv' },
  { workflow: 'compliance', label: 'Datenschutz', task: 'dsfa' },
  { workflow: 'advertising', label: 'Werbung', task: 'general' },
] as const;

async function choose(page: Page, task: (typeof tasks)[number]) {
  await page.getByRole('button', { name: task.label, exact: true }).click();
  if (task.workflow === 'compliance')
    await page.getByRole('combobox', { name: 'Datenschutz-Aufgabe' }).selectOption(task.task);
}

const sourceInput = (page: Page) =>
  page.getByRole('textbox', { name: 'Text oder E-Mail-Verlauf (optional)', exact: true });
const contextInput = (page: Page) => page.getByRole('textbox', { name: /^Prüfauftrag/ });
const runButton = (page: Page) =>
  page.getByRole('button', { name: 'Analyse starten', exact: true });

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort('blockedbyclient');
    if (url.pathname === '/api/health')
      return route.fulfill({ json: { status: 'ok', api_configured: true } });
    if (['/api/documents', '/api/playbooks', '/api/analyses'].includes(url.pathname)) {
      if (route.request().method() === 'GET') return route.fulfill({ json: [] });
      // An unhandled analysis must never reach a provider, even with a configured local server.
      return route.fulfill({ status: 500, json: { detail: 'Nicht abgefangene Testanfrage.' } });
    }
    return route.continue();
  });
});

test('task drafts keep evidence separate from instructions through switches and request errors', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/analyses', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    requests.push(route.request().postDataJSON());
    return route.fulfill({
      status: 503,
      json: { detail: 'Offline-Test: Analyse fehlgeschlagen.' },
    });
  });
  await page.goto('/');

  for (const task of tasks) {
    await choose(page, task);
    await expect(sourceInput(page)).toHaveValue('');
    const identity = `${task.workflow}/${task.task}`;
    await sourceInput(page).fill(`Von: Mandant\nBetreff: ${identity}\nDie Lieferung fehlt.`);
    await contextInput(page).fill(`Auftrag ${identity}: Widersprüche benennen.`);
  }

  for (const task of [...tasks].reverse()) {
    await choose(page, task);
    const identity = `${task.workflow}/${task.task}`;
    const evidence = `Von: Mandant\nBetreff: ${identity}\nDie Lieferung fehlt.`;
    const instruction = `Auftrag ${identity}: Widersprüche benennen.`;
    await expect(sourceInput(page)).toHaveValue(evidence);
    await expect(contextInput(page)).toHaveValue(instruction);
    if (task.workflow === 'compare') continue;

    const count = requests.length;
    await runButton(page).click();
    await expect(page.getByRole('alert')).toContainText('Offline-Test: Analyse fehlgeschlagen.');
    expect(requests).toHaveLength(count + 1);
    expect(requests.at(-1)).toMatchObject({
      workflow: task.workflow,
      compliance_task: task.task,
      document_ids: [],
      source_text: evidence,
      context: instruction,
    });
    await expect(sourceInput(page)).toHaveValue(evidence);
    await expect(contextInput(page)).toHaveValue(instruction);
    await expect(runButton(page)).toBeEnabled();
  }
  const oversized = 'A'.repeat(300_001);
  const count = requests.length;
  await sourceInput(page).fill(oversized);
  await expect(sourceInput(page)).toHaveValue(oversized);
  await expect(sourceInput(page)).toHaveAttribute('aria-invalid', 'true');
  await runButton(page).click();
  await expect(page.getByRole('alert')).toContainText('300.000');
  expect(requests).toHaveLength(count);
  await expect(sourceInput(page)).toHaveValue(oversized);
});

test('cancelling retains both inputs and a successful retry opens the pasted source context', async ({
  page,
}) => {
  let pending: Route | undefined;
  await page.route('**/api/analyses', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    pending = route;
    // Leave the response pending so cancellation exercises the application's AbortController.
  });
  await page.goto('/');
  await choose(page, tasks[2]);
  const evidence = 'E-Mail vom 17.09.2026\nDer Kunde meldet eine ausstehende Lieferung.';
  const instruction = 'Lieferdatum und Dokumentdatum getrennt darstellen.';
  await sourceInput(page).fill(evidence);
  await contextInput(page).fill(instruction);
  await runButton(page).click();
  await expect.poll(() => pending !== undefined).toBe(true);
  await expect(sourceInput(page)).toBeDisabled();
  await page.getByRole('button', { name: 'Warten abbrechen', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Das Warten wurde abgebrochen.');
  await expect(sourceInput(page)).toBeEnabled();
  await expect(sourceInput(page)).toHaveValue(evidence);
  await expect(contextInput(page)).toHaveValue(instruction);
  await expect(runButton(page)).toBeEnabled();
  await pending!.abort('aborted');
  await choose(page, tasks[0]);
  await choose(page, tasks[2]);
  await expect(sourceInput(page)).toHaveValue(evidence);
  await expect(contextInput(page)).toHaveValue(instruction);

  const sourceId = 'pasted-source-retry';
  const sourceName = 'Text · Lieferstand aus eingefügter E-Mail.txt';
  await page.route('**/api/analyses', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    expect(route.request().postDataJSON()).toMatchObject({
      document_ids: [],
      source_text: evidence,
      context: instruction,
    });
    return route.fulfill({
      json: {
        id: 'pasted-analysis-retry',
        title: 'Lieferstand aus eingefügter E-Mail',
        workflow: 'chronology',
        document_ids: [],
        source_text_document_id: sourceId,
        source_text_document_name: sourceName,
        summary: 'Der Kunde meldet eine ausstehende Lieferung.',
        findings: [
          {
            id: 'pasted-finding',
            title: 'Lieferbeleg fehlt',
            severity: 'medium',
            category: 'Beweismittel',
            description: 'Empfangsbeleg mit der Kundenmeldung abgleichen.',
            source_quote: 'Der Kunde meldet eine ausstehende Lieferung.',
            source_document_id: sourceId,
            source_document_name: sourceName,
            source_location: 'E-Mail',
            suggestion: '',
            legal_basis: '',
            verified: true,
          },
        ],
        timeline: [],
        questions: [],
        created_at: '2026-10-03T12:00:00Z',
        model: 'Synthetischer Test',
        effort: 'high',
        is_demo: true,
      },
    });
  });
  await runButton(page).click();
  await expect(
    page.getByRole('heading', { name: 'Lieferstand aus eingefügter E-Mail' }),
  ).toBeVisible();
  await page.getByRole('tab', { name: /Befunde/ }).click();
  const source = page.getByRole('complementary', { name: 'Quellenansicht' });
  await source.getByRole('button', { name: 'Kontext anzeigen', exact: true }).click();
  await expect(source.getByText(/E-Mail vom 17\.09\.2026/)).toBeVisible();
});

test('comparison still requires two versions and submits pasted correspondence as an extra source', async ({
  page,
}) => {
  const documents = [
    {
      id: 'pasted-original',
      name: 'Original.txt',
      text: 'Die Laufzeit beträgt zwölf Monate.',
      page_count: 1,
      char_count: 33,
    },
    {
      id: 'pasted-counterproposal',
      name: 'Gegenentwurf.txt',
      text: 'Die Laufzeit beträgt sechs Monate.',
      page_count: 1,
      char_count: 33,
    },
  ];
  await page.route('**/api/documents', (route) => route.fulfill({ json: documents }));
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/analyses', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, json: { detail: 'Offline-Test: Vergleich erfasst.' } });
  });
  await page.goto('/');
  await choose(page, tasks[1]);
  const evidence = 'Verhandlungs-E-Mail: Gewünscht sind höchstens sechs Monate Laufzeit.';
  await sourceInput(page).fill(evidence);
  await runButton(page).click();
  await expect(page.getByRole('alert')).toContainText(/zwei/);
  expect(requests).toHaveLength(0);

  await page.getByRole('button', { name: 'Gespeicherte auswählen' }).click();
  const picker = page.getByRole('dialog', { name: 'Gespeicherte Dokumente' });
  await picker.getByRole('checkbox', { name: 'Original.txt', exact: true }).check();
  await picker.getByRole('checkbox', { name: 'Gegenentwurf.txt', exact: true }).check();
  await picker.getByRole('button', { name: '2 Dokumente übernehmen' }).click();
  await runButton(page).click();
  await expect(page.getByRole('alert')).toContainText('Offline-Test: Vergleich erfasst.');
  expect(requests).toEqual([
    expect.objectContaining({
      workflow: 'compare',
      document_ids: ['pasted-original', 'pasted-counterproposal'],
      source_text: evidence,
      context: '',
    }),
  ]);

  await page.getByRole('button', { name: 'Original.txt aus Auswahl entfernen' }).click();
  await runButton(page).click();
  await expect(page.getByRole('alert')).toContainText(/zwei/);
  expect(requests).toHaveLength(1);
  await expect(sourceInput(page)).toHaveValue(evidence);
});

const geometrySelectors = [
  '.analysis-start-heading',
  '.workflow-selector',
  '#analysis-source-text',
  '#analysis-context',
  '.composer-toolbar',
];

async function sampleGeometry(page: Page, frames: number) {
  return page.evaluate(
    async ({ selectors, frames }) => {
      const samples = [];
      for (let frame = 0; frame < frames; frame++) {
        const main = document.querySelector('main')!;
        samples.push({
          boxes: selectors.map((selector) => {
            const element = document.querySelector(selector);
            if (!element) throw new Error(`Missing control: ${selector}`);
            const { x, y, width, height } = element.getBoundingClientRect();
            return { x, y, width, height };
          }),
          pageOverflow: document.documentElement.scrollWidth - innerWidth,
          mainOverflow: main.scrollWidth - main.clientWidth,
          scrollTop: main.scrollTop,
        });
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      return samples;
    },
    { selectors: geometrySelectors, frames },
  );
}

async function expectStableInput(page: Page, input: () => Promise<void>) {
  const [before] = await sampleGeometry(page, 1);
  const recording = sampleGeometry(page, 20);
  await input();
  const samples = [...(await recording), ...(await sampleGeometry(page, 1))];
  for (const sample of samples) {
    expect(sample.pageOverflow, 'horizontal page overflow').toBeLessThanOrEqual(1);
    expect(sample.mainOverflow, 'horizontal content overflow').toBeLessThanOrEqual(1);
    expect(
      Math.abs(sample.scrollTop - before.scrollTop),
      'unrequested page scrolling',
    ).toBeLessThanOrEqual(0.5);
    for (const [index, box] of sample.boxes.entries())
      for (const axis of ['x', 'y', 'width', 'height'] as const)
        expect(
          Math.abs(box[axis] - before.boxes[index][axis]),
          `${geometrySelectors[index]} ${axis} changed during text entry`,
        ).toBeLessThanOrEqual(0.5);
  }
}

test('100k pasted characters scroll inside the field without moving controls in either theme', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const evidence = (
    'Von: Mandant\nBetreff: Lieferverlauf\nAm 17. September war die Lieferung noch offen.\n\n' +
    'Aktenzeichen-ohne-Leerzeichen-'.repeat(40) +
    '\n'
  )
    .repeat(100)
    .slice(0, 100_000);
  expect(evidence.length).toBe(100_000);
  for (const theme of ['Hell', 'Dunkel']) {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto('/#settings');
    await page.getByRole('radio', { name: theme, exact: true }).check();
    await page.goto('/#new');
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await sourceInput(page).fill('');
      await sourceInput(page).focus();
      await page.evaluate(() => document.fonts.ready);
      const sourceBox = await sourceInput(page).boundingBox();
      const contextBox = await contextInput(page).boundingBox();
      expect(sourceBox!.y + sourceBox!.height).toBeLessThanOrEqual(contextBox!.y);

      await expectStableInput(page, () => sourceInput(page).pressSequentially('Kurze Notiz.'));
      await sourceInput(page).press('ControlOrMeta+A');
      await expectStableInput(page, () => page.keyboard.insertText(evidence));
      await expect(sourceInput(page)).toHaveValue(evidence);
      const scroll = await sourceInput(page).evaluate((element: HTMLTextAreaElement) => {
        element.scrollTop = element.scrollHeight;
        return {
          content: element.scrollHeight,
          visible: element.clientHeight,
          top: element.scrollTop,
        };
      });
      expect(scroll.content).toBeGreaterThan(scroll.visible);
      expect(scroll.top).toBeGreaterThan(0);
      await expect(contextInput(page)).toHaveValue('');
    }
  }
});
