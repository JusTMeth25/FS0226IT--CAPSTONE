import { useState } from 'react';
import { m } from 'motion/react';
import StarBurst from '../phantom/StarBurst.jsx';
import { apiClient } from '../../services/apiClient.js';
import GradedSlab from './GradedSlab.jsx';

const GRADING_FEE = 50;

const LABELS = {
  10: 'Gemma perfetta', 9: 'Quasi perfetta', 8: 'Ottima', 7: 'Molto buona', 6: 'Buona', 5: 'Discreta'
};
const BONUS = { 10: '+100%', 9: '+60%', 8: '+35%', 7: '+15%', 6: 'invariato', 5: '-10%' };

function gradeLabel(grade) {
  return LABELS[grade] || 'Rovinata';
}

/** Targhetta del voto, come le custodie delle agenzie di gradazione. */
export function GradeBadge({ grade }) {
  if (!grade) return null;
  return (
    <span className={`grade-badge grade-${grade >= 9 ? 'top' : grade >= 7 ? 'good' : 'low'}`} title={`Voto del perito: ${grade} (${gradeLabel(grade)})`}>
      VDX <b>{grade}</b>
    </span>
  );
}

/**
 * Il perito dell'hotel esamina la carta e le da' un voto da 1 a 10. Si fa una volta sola:
 * un voto alto fa valere la copia di piu' al negozio e negli scambi con gli NPC.
 */
export default function GradingBox({ card, gold, onGraded }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState(null);
  const grade = revealed?.grade ?? card.grade;

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.post(`/grading/${encodeURIComponent(card.id)}`);
      setRevealed(res);
      onGraded?.();
    } catch (err) {
      setError(err?.code === 'card_already_graded' ? 'Questa carta e\' gia\' stata gradata.'
        : err?.status === 402 || err?.code === 'insufficient_gold' ? 'Non hai abbastanza gold.'
          : 'Il perito non e\' disponibile, riprova.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`grading-box${revealed ? ' is-revealed' : ''}`}>
      <div className="grading-head">
        <i className="ph-fill ph-magnifying-glass" />
        <div>
          <strong>Ottavio il perito</strong>
          <span>{grade ? 'Ha esaminato la tua copia.' : 'Esamina la carta e le da\' un voto da 1 a 10.'}</span>
        </div>
      </div>
      {/* Voto appena dato: il cofanetto cade dall'alto e il voto si stampa sopra come un timbro,
          con la stella dietro. Con "riduci animazioni" MotionConfig salta gli spostamenti. */}
      {revealed && (
        <m.div className="grading-sealed" initial={{ y: -48, rotate: -4, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 24 }}>
          <GradedSlab card={{ ...card, grade: revealed.grade }} size="large" />
          <p>La carta e&apos; stata sigillata nel cofanetto del perito.</p>
        </m.div>
      )}
      {grade ? (
        <div className={`grading-result${revealed ? ' just-graded' : ''}`}>
          {/* Lama magenta dietro il timbro: entra di taglio appena prima del voto. */}
          {revealed && <m.span className="cx-grade-slash" aria-hidden="true" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: 0.22, delay: 0.2, ease: [0.7, 0, 0.3, 1] }} />}
          <m.span className="cx-grade-stamp" initial={revealed ? { scale: 2.6, rotate: -24, opacity: 0 } : false}
            animate={{ scale: 1, rotate: -6, opacity: 1 }} transition={{ type: 'spring', stiffness: 620, damping: 20, delay: revealed ? 0.35 : 0 }}>
            {revealed && <StarBurst size={84} fill="var(--neon-gold)" stroke="#000" className="cx-grade-star" />}
            <GradeBadge grade={grade} />
          </m.span>
          <div>
            <strong>{gradeLabel(grade)}</strong>
            <span>Valore al negozio e negli scambi NPC: {BONUS[grade] || '-20%'}</span>
          </div>
        </div>
      ) : (
        <>
          <p className="grading-note">Un voto alto (8-10) fa valere la copia fino al doppio; uno basso la svaluta un po&apos;. Si fa una volta sola.</p>
          <button type="button" className="btn btn-gold" disabled={busy || gold < GRADING_FEE} onClick={ask}>
            <i className="ph-fill ph-coin" /> {busy ? 'Il perito sta guardando…' : `Fai gradare · ${GRADING_FEE} gold`}
          </button>
        </>
      )}
      {error && <p className="grading-error" role="alert">{error}</p>}
    </div>
  );
}
