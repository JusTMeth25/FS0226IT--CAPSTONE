import { useEffect, useState } from 'react';
import { m } from 'motion/react';
import { resolveCardImage } from '../../utils/cardUtils.js';

/**
 * Quiz "Indovina la carta": la carta arriva molto sfocata e si schiarisce col passare dei secondi.
 * Si risponde scrivendo il nome in chat; il server decide chi ha indovinato per primo.
 * `result` e' la fine del quiz (nome, carta e vincitore), mostrata per qualche secondo.
 */
export default function QuizOverlay({ quiz, result, clockOffset = 0, onClose }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  if (result) {
    return (
      <div className="hotel-panel quiz-panel quiz-result" role="status">
        <header className="hotel-panel-header">
          <h3><i className="ph-fill ph-question" /> Quiz</h3>
          <button type="button" className="hotel-panel-close" onClick={onClose} aria-label="Chiudi"><i className="ph ph-x" /></button>
        </header>
        <div className="quiz-body">
          {/* Fine del quiz: la carta si rivela con uno scatto, poi il nome e chi ha vinto. */}
          <m.div className="quiz-card-wrap is-revealed" initial={{ scale: 0.86, rotate: -6, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 24 }}>
            <img className="quiz-card" src={resolveCardImage(result.card)} alt={result.name} />
          </m.div>
          <m.p className="quiz-answer" initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.2, delay: 0.15 }}>
            Era <strong>{result.name}</strong>
          </m.p>
          <m.p className={result.winner ? 'quiz-winner' : 'quiz-nobody'} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 600, damping: 24, delay: 0.25 }}>
            {result.winner ? <><i className="ph-fill ph-trophy" /> Indovinata da {result.winner}! (+30 gold)</> : 'Nessuno l\'ha indovinata.'}
          </m.p>
        </div>
      </div>
    );
  }
  if (!quiz) return null;
  const serverNow = now + clockOffset;
  const total = quiz.deadline - quiz.startedAt;
  const progress = Math.min(1, Math.max(0, (serverNow - quiz.startedAt) / total));
  const left = Math.max(0, Math.ceil((quiz.deadline - serverNow) / 1000));
  // Da 22px di sfocatura a quasi niente: verso la fine il nome stampato sulla carta si legge.
  const blur = Math.round(22 * (1 - progress) ** 1.6);
  return (
    <div className="hotel-panel quiz-panel" role="dialog" aria-label="Quiz: indovina la carta">
      <header className="hotel-panel-header">
        <h3><i className="ph-fill ph-question" /> Indovina la carta</h3>
        <span className={`pvp-timer${left <= 10 ? ' urgent' : ''}`}>{left}s</span>
      </header>
      <div className="quiz-body">
        <div className="quiz-card-wrap">
          <img className="quiz-card" src={resolveCardImage(quiz.card)} alt="Carta misteriosa" style={{ filter: `blur(${blur}px) saturate(1.2)` }} />
        </div>
        <p className="quiz-hint">Inizia con <strong>{quiz.initial}</strong> · {quiz.letters} lettere</p>
        <p className="hotel-panel-hint">Scrivi il nome in chat: il primo che indovina vince 30 gold.</p>
      </div>
    </div>
  );
}
