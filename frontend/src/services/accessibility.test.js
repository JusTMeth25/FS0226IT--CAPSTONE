import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'vinyldex_a11y';

/** Il modulo legge localStorage quando viene caricato: per ogni scenario se ne carica una copia nuova. */
async function loadModule() {
  vi.resetModules();
  return import('./accessibility.js');
}

const html = () => document.documentElement;

describe('accessibility: impostazioni del dispositivo', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('senza niente salvato parte dai valori predefiniti', async () => {
    const a11y = await loadModule();
    expect(a11y.getAccessibility()).toEqual({ safe: false, cvd: '', contrast: false, warned: false });
    expect(a11y.isSafeMode()).toBe(false);
    expect(a11y.CVD_MODES).toEqual(['', 'rg', 'by', 'mono']);
  });

  it('legge le scelte salvate in precedenza', async () => {
    localStorage.setItem(KEY, JSON.stringify({ safe: true, cvd: 'by', contrast: true, warned: true }));
    const a11y = await loadModule();
    expect(a11y.getAccessibility()).toEqual({ safe: true, cvd: 'by', contrast: true, warned: true });
    expect(a11y.isSafeMode()).toBe(true);
  });

  it('JSON rotto in localStorage: si torna ai valori predefiniti', async () => {
    localStorage.setItem(KEY, '{non e\' json');
    const a11y = await loadModule();
    expect(a11y.getAccessibility()).toEqual({ safe: false, cvd: '', contrast: false, warned: false });
  });

  it('valori del tipo sbagliato o sconosciuti vengono scartati uno per uno', async () => {
    localStorage.setItem(KEY, JSON.stringify({ safe: 'true', cvd: 'viola', contrast: 1, warned: true }));
    const a11y = await loadModule();
    expect(a11y.getAccessibility()).toEqual({ safe: false, cvd: '', contrast: false, warned: true });
  });

  it('localStorage che lancia eccezione in lettura: valori predefiniti', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('accesso negato');
    });
    const a11y = await loadModule();
    expect(a11y.getAccessibility()).toEqual({ safe: false, cvd: '', contrast: false, warned: false });
  });

  it('setAccessibility salva, mette gli attributi su <html> e avvisa chi ascolta', async () => {
    const a11y = await loadModule();
    const listener = vi.fn();
    a11y.subscribeAccessibility(listener);

    a11y.setAccessibility({ safe: true, cvd: 'rg', contrast: true });

    const expected = { safe: true, cvd: 'rg', contrast: true, warned: false };
    expect(a11y.getAccessibility()).toEqual(expected);
    expect(JSON.parse(localStorage.getItem(KEY))).toEqual(expected);
    expect(html()).toHaveAttribute('data-a11y-safe');
    expect(html()).toHaveAttribute('data-cvd', 'rg');
    expect(html()).toHaveAttribute('data-contrast', 'high');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expected);
  });

  it('una modifica parziale tiene le altre scelte', async () => {
    const a11y = await loadModule();
    a11y.setAccessibility({ cvd: 'mono' });
    a11y.setAccessibility({ warned: true });
    expect(a11y.getAccessibility()).toEqual({ safe: false, cvd: 'mono', contrast: false, warned: true });
  });

  it('spegnendo le scelte gli attributi spariscono da <html>', async () => {
    const a11y = await loadModule();
    a11y.setAccessibility({ safe: true, cvd: 'by', contrast: true });
    a11y.setAccessibility({ safe: false, cvd: '', contrast: false });
    expect(html()).not.toHaveAttribute('data-a11y-safe');
    expect(html()).not.toHaveAttribute('data-cvd');
    expect(html()).not.toHaveAttribute('data-contrast');
  });

  it('resetAccessibility rimette i valori predefiniti ma ricorda che l\'avviso e\' stato visto', async () => {
    const a11y = await loadModule();
    a11y.setAccessibility({ safe: true, cvd: 'rg', contrast: true, warned: true });
    a11y.resetAccessibility();
    expect(a11y.getAccessibility()).toEqual({ safe: false, cvd: '', contrast: false, warned: true });
    expect(html()).not.toHaveAttribute('data-cvd');
  });

  it('applyAccessibility scrive su <html> le scelte caricate all\'avvio', async () => {
    localStorage.setItem(KEY, JSON.stringify({ safe: true, cvd: 'mono' }));
    const a11y = await loadModule();
    expect(html()).not.toHaveAttribute('data-cvd');
    a11y.applyAccessibility();
    expect(html()).toHaveAttribute('data-a11y-safe');
    expect(html()).toHaveAttribute('data-cvd', 'mono');
    expect(html()).not.toHaveAttribute('data-contrast');
  });

  it('dopo l\'unsubscribe chi ascoltava non viene piu\' avvisato', async () => {
    const a11y = await loadModule();
    const listener = vi.fn();
    const unsubscribe = a11y.subscribeAccessibility(listener);
    a11y.setAccessibility({ safe: true });
    unsubscribe();
    a11y.setAccessibility({ safe: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('se localStorage non salva, la scelta vale lo stesso per la pagina aperta', async () => {
    const a11y = await loadModule();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota piena');
    });
    expect(() => a11y.setAccessibility({ contrast: true })).not.toThrow();
    expect(a11y.getAccessibility().contrast).toBe(true);
    expect(html()).toHaveAttribute('data-contrast', 'high');
  });
});
