import { getAvatarUrl } from '../../utils/avatarUtils.js';

/** Avatar utente: mostra l'immagine scelta, o un'icona generica se non ne ha ancora selezionata una. */
export default function UserAvatar({ avatar, className = '', fallbackIcon = 'ph-user-circle' }) {
  const url = getAvatarUrl(avatar);
  return (
    <span className={className}>
      {url ? <img src={url} alt="" /> : <i className={`ph-fill ${fallbackIcon}`} />}
    </span>
  );
}
