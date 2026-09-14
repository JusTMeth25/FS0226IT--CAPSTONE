import { useMemo } from 'react';

/** Traguardi dell'album, in percentuale di catalogo completato. */
const MILESTONES = [25, 50, 75, 100];

/**
 * Barra di completamento dell'album con i traguardi visibili.
 *
 * Una percentuale da sola non dice quanto manca a qualcosa: e' un numero che sale e basta.
 * Le tacche trasformano il progresso in obiettivi raggiungibili, e la riga sotto dice
 * quante carte separano dal prossimo.
 *
 * E' un componente a se' e non una modifica a .progress-bar perche' quella classe la usa
 * anche la barra dell'esperienza nella sidebar, dove i traguardi non avrebbero senso.
 *
 * @param {number} percent completamento, da 0 a 100
 * @param {number} [owned] carte possedute, per calcolare quante ne mancano
 * @param {number} [total] carte totali del catalogo
 */
export default function AlbumProgress({ percent, owned, total }) {
  const safePercent = Math.max(0, Math.min(100, Math.round(percent || 0)));

  const next = useMemo(() => {
    const target = MILESTONES.find((m) => m > safePercent);
    if (!target) return null;

    // Il numero di carte mancanti si puo' dare solo se si conosce la dimensione del
    // catalogo: in modalita' ospite si mostra il solo traguardo in percentuale.
    if (typeof owned !== 'number' || typeof total !== 'number' || total <= 0) {
      return { target, missing: null };
    }

    const cardsNeeded = Math.ceil((target / 100) * total) - owned;
    return { target, missing: Math.max(0, cardsNeeded) };
  }, [safePercent, owned, total]);

  return (
    <div className="album-progress">
      <div className="album-progress-track">
        <div className="album-progress-fill" style={{ width: `${safePercent}%` }} />

        {/* Il traguardo al 100% cadrebbe a meta' fuori dalla barra: viene ancorato
            al bordo destro invece che alla sua percentuale. */}
        {MILESTONES.map((milestone) => (
          <span
            key={milestone}
            className={`album-progress-tick${safePercent >= milestone ? ' reached' : ''}${milestone === 100 ? ' last' : ''}`}
            style={{ left: `${milestone}%` }}
            title={`${milestone}%`}
          >
            <i className={safePercent >= milestone ? 'ph-fill ph-check-circle' : 'ph-fill ph-circle'} />
          </span>
        ))}
      </div>

      <p className="album-progress-hint">
        {next ? (
          <>
            Prossimo traguardo <strong>{next.target}%</strong>
            {next.missing !== null && <> — mancano <strong>{next.missing}</strong> {next.missing === 1 ? 'carta' : 'carte'}</>}
          </>
        ) : (
          <><i className="ph-fill ph-trophy" /> Album completato</>
        )}
      </p>
    </div>
  );
}
