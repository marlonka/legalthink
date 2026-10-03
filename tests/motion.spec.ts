import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) await route.continue();
    else await route.abort('blockedbyclient');
  });
});

test('rapid disclosure and menu changes keep only current controls interactive', async ({
  page,
}) => {
  await page.goto('/');
  const options = page.getByRole('button', { name: 'Prüfoptionen' });
  await options.focus();
  for (let index = 0; index < 5; index++) await page.keyboard.press('Enter');
  await expect(options).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('combobox', { name: 'Kanzlei-Playbook' })).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('combobox', { name: 'Kanzlei-Playbook' })).toHaveCount(0);
  await expect(options).toBeFocused();

  const model = page.getByRole('button', { name: 'GPT-6 Luna', exact: true });
  await model.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(model).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'GPT-6.1 Sol', exact: true })).toHaveCount(1);
  const effort = page.getByRole('button', { name: 'Denkaufwand: Hoch' });
  await effort.click();
  await expect(page.getByRole('button', { name: 'GPT-6.1 Sol', exact: true })).toHaveCount(0);
  const slider = page.getByRole('slider', { name: 'Denkaufwand' });
  await slider.focus();
  await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Maximum');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Denkaufwand: Maximum' })).toBeFocused();
  await expect(slider).toHaveCount(0);
});

test('dialog exit releases focus and can be reversed without duplicate dialogs', async ({
  page,
}) => {
  await page.goto('/#playbooks');
  const trigger = page.getByRole('button', { name: 'Playbook erstellen', exact: true });
  await trigger.focus();
  for (let index = 0; index < 3; index++) {
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Neues Playbook' });
    await expect(dialog).toHaveCount(1);
    await expect
      .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Neues Playbook' });
  await dialog.getByLabel('Name', { exact: true }).fill('Nicht speichern');
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});

test('live reduced-motion preference removes movement while mobile controls stay usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Navigation öffnen' });
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  // Change the OS preference while the existing component tree is mounted.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog', { name: 'Hauptnavigation' });
  const frames = await drawer.evaluate(async (element) => {
    const values: { transform: string; opacity: string }[] = [];
    for (let index = 0; index < 8; index++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const style = getComputedStyle(element);
      values.push({ transform: style.transform, opacity: style.opacity });
    }
    return values;
  });
  expect(
    frames.every(
      ({ transform, opacity }) =>
        ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(transform) && opacity === '1',
    ),
  ).toBe(true);
  await drawer.getByRole('button', { name: 'Kanzlei-Playbooks', exact: true }).click();
  await page.getByRole('button', { name: 'Playbook erstellen', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Neues Playbook' });
  expect(await modal.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Playbook erstellen', exact: true })).toBeFocused();
});
