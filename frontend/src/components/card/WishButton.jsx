import { useEffect, useState } from 'react';
import { extrasApi } from '../../services/extrasApi.js';

/** Cuore della lista dei desideri: si accende quando la carta e' fra quelle cercate. */
export default function WishButton({ code }) {
  const [wished, setWished] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    extrasApi.wishCodes().then((codes) => { if (!cancelled) setWished(codes.includes(code)); }).catch(() => {});
    return () => { cancelled = true; };
  }, [code]);

  const toggle = () => {
    setBusy(true);
    (wished ? extrasApi.removeWish(code) : extrasApi.addWish(code))
      .then((res) => setWished(res.wished))
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  if (wished === null) return null;
  return (
    <button type="button" className={`btn ${wished ? 'btn-gold' : 'btn-secondary'} wish-button`} onClick={toggle} disabled={busy} aria-pressed={wished}>
      <i className={wished ? 'ph-fill ph-heart' : 'ph ph-heart'} /> {wished ? 'Nei desideri' : 'Aggiungi ai desideri'}
    </button>
  );
}
