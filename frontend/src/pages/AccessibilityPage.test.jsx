import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccessibility, setAccessibility } from '../services/accessibility.js';
import { RARITY_PALETTES } from '../utils/rarityPalettes.js';
import AccessibilityPage from './AccessibilityPage.jsx';

// La pagina chiede solo se l'utente ha fatto l'accesso: niente AuthProvider vero.
const auth = vi.hoisted(() => ({ isAuthenticated: false }));
vi.mock('../hooks/useAuth.js', () => ({ useAuth: () => auth }));

function renderPage() {
  return render(
    <MemoryRouter>
      <AccessibilityPage />
    </MemoryRouter>
  );
}

const status = () => screen.getByRole('status');

describe('AccessibilityPage', () => {
  beforeEach(() => {
    setAccessibility({ safe: false, cvd: '', contrast: false, warned: true });
    auth.isAuthenticated = false;
  });

  it('mostra le scelte attuali', () => {
    setAccessibility({ safe: true, cvd: 'by' });
    renderPage();
    expect(screen.getByRole('switch', { name: /modalità sicura/i })).toBeChecked();
    expect(screen.getByRole('switch', { name: /alto contrasto/i })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /blu-giallo/i })).toBeChecked();
  });

  it('l\'interruttore della modalita\' sicura la accende e la spegne', async () => {
    const user = userEvent.setup();
    renderPage();
    const toggle = screen.getByRole('switch', { name: /modalità sicura/i });

    await user.click(toggle);
    expect(toggle).toBeChecked();
    expect(getAccessibility().safe).toBe(true);
    expect(document.documentElement).toHaveAttribute('data-a11y-safe');
    expect(status()).toHaveTextContent('Modalità sicura attiva.');

    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(getAccessibility().safe).toBe(false);
    expect(status()).toHaveTextContent('Modalità sicura spenta.');
  });

  it('l\'interruttore dell\'alto contrasto mette data-contrast su <html>', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('switch', { name: /alto contrasto/i }));
    expect(getAccessibility().contrast).toBe(true);
    expect(document.documentElement).toHaveAttribute('data-contrast', 'high');
    expect(status()).toHaveTextContent('Alto contrasto attivo.');
  });

  it('i radio del daltonismo cambiano la modalita\' e l\'anteprima delle rarita\'', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByRole('radio', { name: /nessuno/i })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: /rosso-verde/i }));
    expect(getAccessibility().cvd).toBe('rg');
    expect(document.documentElement).toHaveAttribute('data-cvd', 'rg');
    expect(status()).toHaveTextContent('Daltonismo: Rosso-verde.');
    const preview = screen.getByRole('list', { name: /anteprima dei colori/i });
    expect(preview).toHaveAttribute('data-cvd-mode', 'rg');
    expect(preview.querySelector('li').style.getPropertyValue('--preview-color')).toBe(RARITY_PALETTES.rg.common);

    await user.click(screen.getByRole('radio', { name: /scala di grigi/i }));
    expect(getAccessibility().cvd).toBe('mono');
    expect(screen.getByRole('radio', { name: /rosso-verde/i })).not.toBeChecked();
  });

  it('"Ripristina" spegne tutto e lo dice', async () => {
    setAccessibility({ safe: true, cvd: 'mono', contrast: true });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /ripristina/i }));
    expect(getAccessibility()).toEqual({ safe: false, cvd: '', contrast: false, warned: true });
    expect(screen.getByRole('switch', { name: /modalità sicura/i })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /nessuno/i })).toBeChecked();
    expect(status()).toHaveTextContent('Impostazioni ripristinate.');
  });

  it('senza accesso c\'e\' il link per tornare al login, con l\'accesso no', () => {
    const { unmount } = renderPage();
    expect(screen.getByRole('link', { name: /torna all'accesso/i })).toHaveAttribute('href', '/login');
    unmount();
    auth.isAuthenticated = true;
    renderPage();
    expect(screen.queryByRole('link', { name: /torna all'accesso/i })).not.toBeInTheDocument();
  });
});
