import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const dataDir = path.resolve('artifacts', `e2e-data-${Date.now()}`);

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/built.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5174',
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
        LEGALTHINK_ALLOWED_ORIGINS: 'http://127.0.0.1:5174,http://127.0.0.1:8011',
      },
    },
    {
      command: 'npm --prefix frontend run dev -- --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      env: { VITE_API_PROXY: 'http://127.0.0.1:8011' },
    },
  ],
});
