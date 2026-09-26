import { useEffect, useRef, useState } from 'react';
import { hotelApi } from '../../services/hotelApi.js';
import { PET_H, PET_W, petSprite } from '../sprites/pet.js';

const ERRORS = {
  pet_owned: 'Hai gia\' un animale.',
  pet_type: 'Animale sconosciuto.',
  insufficient_gold: 'Non hai abbastanza gold.'
};

/** L'animale in grande, che trotterella sul posto. */
export function PetPreview({ type, scale = 4 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(petSprite(type, frame, false), 0, 0, PET_W * scale, PET_H * scale);
    };
    draw();
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return undefined;
    const timer = setInterval(() => { frame = 1 - frame; draw(); }, 300);
    return () => clearInterval(timer);
  }, [type, scale]);
  return <canvas ref={ref} width={PET_W * scale} height={PET_H * scale} className="pet-preview" aria-hidden="true" />;
}

/**
 * Scheda "Animali" del negozio: si adotta un cane, un gatto o un coniglio che segue l'avatar
 * nelle stanze. Va nutrito ogni giorno, se no e' triste (e cammina piano).
 */
export default function PetShop({ gold, onChange }) {
  const [data, setData] = useState(null);
  const [names, setNames] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    hotelApi.pets().then(setData).catch(() => setError('Animali non raggiungibili, riprova.'));
  }, []);

  const run = (promise, message) => {
    setBusy(true);
    setError(null);
    promise.then((res) => { setData(res); onChange?.(message); })
      .catch((err) => setError(ERRORS[err?.code] || (err?.status === 402 ? ERRORS.insufficient_gold : 'Non riuscito, riprova.')))
      .finally(() => setBusy(false));
  };

  if (!data) return <p className="hotel-panel-hint">{error || 'Carico gli animali…'}</p>;
  const pet = data.pet;
  const kind = pet && data.types.find((t) => t.type === pet.type);

  return (
    <div className="pet-shop">
      {error && <p className="hotel-panel-error">{error}</p>}
      {pet ? (
        <div className="pet-mine">
          <PetPreview type={pet.type} scale={6} />
          <div>
            <strong>{pet.name}</strong>
            <span>{kind?.name}</span>
            <span className={pet.hungry ? 'pet-hungry' : 'pet-happy'}>
              {pet.hungry ? 'Ha fame! Dagli da mangiare.' : 'Sazio e felice.'}
            </span>
            <div className="pet-actions">
              <button type="button" className="btn btn-gold btn-small" disabled={busy || gold < data.foodPrice}
                onClick={() => run(hotelApi.feedPet(), `${pet.name} ha mangiato!`)}>
                <i className="ph-fill ph-bowl-food" /> Dai da mangiare · {data.foodPrice}
              </button>
              <button type="button" className="btn btn-secondary btn-small" disabled={busy}
                onClick={() => { if (window.confirm(`${pet.name} andra' a vivere in una fattoria. Sicuro?`)) run(hotelApi.releasePet(), `${pet.name} e' andato in fattoria.`); }}>
                <i className="ph ph-house-line" /> Manda in fattoria
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="hotel-panel-hint">Un animale ti segue nelle stanze. Dagli da mangiare ogni giorno, se no diventa triste.</p>
          <ul className="hotel-furni-grid">
            {data.types.map((t) => (
              <li key={t.type} className="hotel-furni-card">
                <PetPreview type={t.type} />
                <strong>{t.name}</strong>
                <input className="pet-name" value={names[t.type] || ''} maxLength={20} placeholder="Nome"
                  aria-label={`Nome del ${t.name.toLowerCase()}`} onChange={(e) => setNames((n) => ({ ...n, [t.type]: e.target.value }))} />
                <button type="button" className="btn btn-gold btn-small" disabled={busy || gold < t.price}
                  onClick={() => run(hotelApi.adoptPet(t.type, names[t.type] || ''), `Benvenuto ${names[t.type] || t.name}!`)}>
                  <i className="ph-fill ph-coin" /> {t.price}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
