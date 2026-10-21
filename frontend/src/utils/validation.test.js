import { describe, expect, it } from 'vitest';
import { EMAIL_REGEX, isValidEmail } from './validation.js';

describe('validation: isValidEmail', () => {
  it.each([
    'mario.rossi@example.com',
    'a@b.it',
    'utente+tag@sotto.dominio.org',
    'nome_cognome%1@my-host.co.uk',
    'MAIUSCOLE@ESEMPIO.COM'
  ])('accetta un indirizzo valido: %s', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    ['', 'vuota'],
    ['mario', 'senza @'],
    ['mario@', 'senza dominio'],
    ['@example.com', 'senza nome'],
    ['mario@example', 'dominio senza punto'],
    ['mario@example.c', 'suffisso di una lettera'],
    ['mario@@example.com', 'due @'],
    ['mario rossi@example.com', 'spazio nel nome'],
    ['mario@exa mple.com', 'spazio nel dominio'],
    ['mario@example.123', 'suffisso numerico'],
    ['mario@.example.com', 'dominio che comincia con un punto']
  ])('rifiuta un indirizzo non valido: "%s" (%s)', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });

  it('ignora gli spazi all\'inizio e alla fine', () => {
    expect(isValidEmail('  mario@example.com  ')).toBe(true);
    expect(isValidEmail('\tmario@example.com\n')).toBe(true);
  });

  it('non si rompe con null, undefined o numeri', () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(42)).toBe(false);
  });

  it('la regex da sola non toglie gli spazi (lo fa isValidEmail)', () => {
    expect(EMAIL_REGEX.test(' mario@example.com')).toBe(false);
  });
});
