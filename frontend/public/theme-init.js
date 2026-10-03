(function () {
  'use strict';

  const storageKey = 'legalthink-theme';
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const subscribers = new Set();
  const normalize = (value) =>
    value === 'system' || value === 'light' || value === 'dark' ? value : 'dark';
  let preference = 'dark';

  try {
    preference = normalize(window.localStorage.getItem(storageKey));
  } catch {
    // Storage may be unavailable; appearance still works for this page.
  }

  function apply() {
    const theme = preference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : preference;
    const background = theme === 'dark' ? '#0e0e0e' : '#fcfcfc';
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    root.style.backgroundColor = background;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
  }

  function update(value, persist) {
    const next = normalize(value);
    const changed = preference !== next;
    preference = next;
    if (persist) {
      try {
        window.localStorage.setItem(storageKey, preference);
      } catch {
        // Retain the in-memory choice when browser storage is blocked.
      }
    }
    apply();
    if (changed) subscribers.forEach((listener) => listener());
  }

  window.legalThinkTheme = Object.freeze({
    getPreference: () => preference,
    setPreference: (value) => update(value, true),
    subscribe(listener) {
      subscribers.add(listener);
      return () => subscribers.delete(listener);
    },
  });

  systemTheme.addEventListener('change', () => {
    if (preference === 'system') apply();
  });
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey || event.key === null) update(event.newValue, false);
  });

  apply();
})();
