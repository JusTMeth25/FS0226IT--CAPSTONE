/**
 * Giorno corrente come stringa confrontabile.
 *
 * Serve a capire se il bonus di accesso e' gia' stato riscosso oggi. Si confronta la
 * data e non l'istante: la ricompensa e' una al giorno, non una ogni ventiquattro ore.
 */
export function todayString() {
  return new Date().toDateString();
}
