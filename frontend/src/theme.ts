import { useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeController {
  getPreference: () => ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  subscribe: (listener: () => void) => () => void;
}

declare global {
  interface Window {
    legalThinkTheme: ThemeController;
  }
}

// The synchronous head script owns initialization and subsequent updates.
// React observes that same store so the first paint and settings stay in sync.
export function useThemePreference() {
  const controller = window.legalThinkTheme;
  const preference = useSyncExternalStore(controller.subscribe, controller.getPreference);
  return [preference, controller.setPreference] as const;
}
