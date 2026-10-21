import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Senza i globali di Vitest, Testing Library non smonta da sola i componenti fra un test e l'altro.
afterEach(() => {
  cleanup();
  localStorage.clear();
  // Le impostazioni di accessibilita' finiscono su <html>: ogni test riparte pulito.
  const root = document.documentElement;
  ['data-a11y-safe', 'data-cvd', 'data-contrast'].forEach((name) => root.removeAttribute(name));
  document.body.style.overflow = '';
});
