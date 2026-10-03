import { defineConfig } from '@playwright/test';
import config from './playwright.config';

export default defineConfig({
  ...config,
  testIgnore: [],
  testMatch: '**/built.spec.ts',
  use: { ...config.use, baseURL: 'http://127.0.0.1:8011' },
  webServer: Array.isArray(config.webServer) ? config.webServer[0] : config.webServer,
});
