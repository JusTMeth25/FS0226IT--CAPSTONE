/**
 * Forma di un'email, la stessa del server (AuthRequests.EMAIL_REGEX): niente spazi, un solo @,
 * dominio con almeno un punto e suffisso di 2+ lettere.
 */
export const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export function isValidEmail(value) {
  return EMAIL_REGEX.test(String(value ?? '').trim());
}
