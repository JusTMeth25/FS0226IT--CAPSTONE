import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { getAccessibility, setAccessibility } from '../../services/accessibility.js';
import PhotosensitivityNotice from './PhotosensitivityNotice.jsx';

const saved = () => JSON.parse(localStorage.getItem('vinyldex_a11y'));

function renderAt(path = '/home') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PhotosensitivityNotice />
      <Routes>
        <Route path="/accessibility" element={<p>Pagina accessibilita'</p>} />
        <Route path="*" element={<p>Altra pagina</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PhotosensitivityNotice', () => {
  beforeEach(() => {
    // Lo stato del modulo resta fra un test e l'altro: si riparte da "mai avvisato".
    setAccessibility({ safe: false, cvd: '', contrast: false, warned: false });
    localStorage.clear();
  });

  it('al primo avvio compare, blocca lo scroll e mette il focus sulla modalita\' sicura', () => {
    renderAt();
    const dialog = screen.getByRole('dialog', { name: /avviso sulla fotosensibilità/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: /attiva la modalità sicura/i })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('non compare se l\'avviso e\' gia\' stato visto', () => {
    setAccessibility({ warned: true });
    renderAt();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('non compare sulla pagina dell\'accessibilita\'', () => {
    renderAt('/accessibility');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Continua" chiude, salva warned e lascia spenta la modalita\' sicura', async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(screen.getByRole('button', { name: 'Continua' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(saved()).toMatchObject({ warned: true, safe: false });
    expect(document.body.style.overflow).toBe('');
  });

  it('Esc vale come "Continua"', async () => {
    const user = userEvent.setup();
    renderAt();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getAccessibility()).toMatchObject({ warned: true, safe: false });
  });

  it('"Attiva la modalità sicura" accende safe e mette data-a11y-safe su <html>', async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(screen.getByRole('button', { name: /attiva la modalità sicura/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(saved()).toMatchObject({ warned: true, safe: true });
    expect(document.documentElement).toHaveAttribute('data-a11y-safe');
  });

  it('il link alle impostazioni porta alla pagina e conta come avviso visto', async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click(screen.getByRole('link', { name: /altre impostazioni di accessibilità/i }));
    expect(screen.getByText("Pagina accessibilita'")).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getAccessibility().warned).toBe(true);
  });

  it('Tab resta dentro la finestra: dall\'ultimo elemento si torna al primo e viceversa', async () => {
    const user = userEvent.setup();
    renderAt();
    const first = screen.getByRole('button', { name: /attiva la modalità sicura/i });
    const last = screen.getByRole('link', { name: /altre impostazioni di accessibilità/i });
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
  });
});
