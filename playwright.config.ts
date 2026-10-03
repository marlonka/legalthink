import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const dataDir = path.resolve('artifacts', `smoke-data-${Date.now()}`);

export default defineConfig({
  testDir: './tests',
  testMatch: '**/built.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:8011',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command:
        'uv run --project backend uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8011',
      url: 'http://127.0.0.1:8011/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        OPENAI_API_KEY: '',
        LEGALTHINK_DATA_DIR: dataDir,
        LEGALTHINK_ALLOW_REMOTE: 'false',
        LEGALTHINK_API_TOKEN: '',
        LEGALTHINK_ALLOWED_ORIGINS: 'http://127.0.0.1:8011',
      },
    },
  ],
});
