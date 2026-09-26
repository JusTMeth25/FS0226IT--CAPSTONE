import { useEffect, useState } from 'react';
import { hotelApi } from '../../services/hotelApi.js';

/**
 * Foto scattate nell'hotel. Nel proprio profilo (senza userId) si possono cancellare; nella
 * scheda di un altro giocatore si guardano soltanto.
 */
export default function PhotoGallery({ userId, compact = false }) {
  const [photos, setPhotos] = useState(null);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let cancelled = false;
    hotelApi.photos(userId).then((res) => { if (!cancelled) setPhotos(res.photos); }).catch(() => { if (!cancelled) setPhotos([]); });
    return () => { cancelled = true; };
  }, [userId]);

  if (!photos || (compact && photos.length === 0)) return null;
  return (
    <section className={`photo-gallery${compact ? ' compact' : ''}`}>
      <h3><i className="ph-fill ph-camera" /> Foto dall&apos;hotel</h3>
      {photos.length === 0 ? (
        <p className="page-subtitle">Nessuna foto: nell&apos;hotel premi il pulsante Foto e mettila nel profilo.</p>
      ) : (
        <ul>
          {photos.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setOpen(p)} aria-label={`Foto di ${p.roomName || 'una stanza'}`}>
                <img src={p.image} alt={p.roomName || 'Foto dell’hotel'} loading="lazy" />
              </button>
              {!userId && !compact && (
                <button type="button" className="photo-delete" aria-label="Cancella la foto"
                  onClick={() => hotelApi.deletePhoto(p.id).then((res) => setPhotos(res.photos)).catch(() => {})}>
                  <i className="ph ph-trash" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {open && (
        <div className="photo-lightbox" role="dialog" aria-label="Foto" onClick={() => setOpen(null)}>
          <img src={open.image} alt={open.roomName || 'Foto'} />
          <p>{open.roomName} · {new Date(open.createdAt).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </div>
      )}
    </section>
  );
}
