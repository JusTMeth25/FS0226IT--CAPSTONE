import { useEffect, useState } from 'react';
import { apiClient } from '../../services/apiClient.js';

/**
 * Pity counter: pacchetti aperti di fila senza leggendaria. Dopo la soglia "soft" la probabilita'
 * sale a ogni pacchetto, alla soglia "hard" la leggendaria e' garantita. `version` lo rilegge.
 */
export default function PityBar({ version }) {
  const [pity, setPity] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.get('/pack-pity').then((res) => { if (!cancelled) setPity(res); }).catch(() => {});
    return () => { cancelled = true; };
  }, [version]);

  if (!pity) return null;
  const percent = Math.min(100, (pity.pity / pity.hard) * 100);
  const softAt = (pity.soft / pity.hard) * 100;
  const left = Math.max(0, pity.hard - pity.pity);
  const boosted = pity.pity >= pity.soft;
  return (
    <div className={`pity-bar glass-panel${boosted ? ' boosted' : ''}`}>
      <div className="pity-head">
        <span><i className="ph-fill ph-crown" /> Leggendaria garantita</span>
        <strong>{left === 0 ? 'al prossimo pacchetto!' : `fra ${left} pacchetti`}</strong>
      </div>
      <div className="pity-track" role="progressbar" aria-valuenow={pity.pity} aria-valuemin={0} aria-valuemax={pity.hard}
        aria-label="Pacchetti di fila senza leggendaria">
        <div className="pity-fill" style={{ width: `${percent}%` }} />
        <span className="pity-soft" style={{ left: `${softAt}%` }} title={`Dal pacchetto ${pity.soft} la probabilita' sale`} />
      </div>
      <small>
        {pity.pity} pacchetti di fila senza leggendaria.
        {boosted ? ' Probabilità di leggendaria aumentata!' : ` Dal ${pity.soft}° la probabilità comincia a salire.`}
      </small>
    </div>
  );
}
