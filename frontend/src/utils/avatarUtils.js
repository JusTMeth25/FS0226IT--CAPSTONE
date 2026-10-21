/**
 * Le 7 immagini avatar selezionabili (frontend/public/assets/img/avatarN.png). Si salva/legge
 * sempre la chiave (es. "avatar3"), mai il path completo, come si aspetta il backend (AuthService.AVAILABLE_AVATARS).
 */
export const AVATARS = ['avatar1', 'avatar2', 'avatar3', 'avatar4', 'avatar5', 'avatar6', 'avatar7'];

/** Restituisce l'URL dell'avatar scelto, o null se l'utente non ne ha ancora selezionato uno. */
export function getAvatarUrl(avatar) {
  return AVATARS.includes(avatar) ? `/assets/img/${avatar}.png` : null;
}
