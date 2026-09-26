import { useEffect, useState } from 'react';
import AvatarPreview from './AvatarPreview.jsx';

/** Vera, la receptionist della lobby, fa da guida (stesso aspetto dell'NPC). */
const GUIDE_LOOK = 's1.h8.hc6.sh0.p1.t2.f0.a1.b1';

/**
 * Passi del tutorial. `target` e' il pulsante della barra da evidenziare (per titolo), se c'e'.
 */
const STEPS = [
  { title: 'Benvenuto al VinylDex Hotel!', text: 'Sono Vera, la receptionist. Ti faccio fare un giro veloce: ci vuole un minuto.' },
  { title: 'Muoverti', text: 'Tocca o clicca il pavimento per camminare. Trascina per spostare la vista; con la rotellina (o due dita sul telefono) ingrandisci.' },
  { title: 'Le stanze', text: 'Dal navigatore scegli dove andare: stadio, piscina, bowling, minigolf, sala giochi... e la tua stanza personale.', target: 'Navigatore' },
  { title: 'Negozio e borsa', text: 'Nel negozio compri mobili e animali; nella borsa trovi mobili e pacchetti comprati in edicola, da aprire quando vuoi.', target: 'Negozio' },
  { title: 'Il tuo look', text: 'Nel guardaroba cambi capelli, vestiti e accessori. Gli altri ti vedono subito.', target: 'Guardaroba' },
  { title: 'Personaggi e scambi', text: 'Clicca le persone: con gli NPC ordini da bere, chiacchieri e scambi carte; con i giocatori scambi, sfide e amicizie.', target: 'Scambi' },
  { title: 'Minigiochi', text: 'Clicca gli attrezzi per giocare: panca e sacco in palestra, canestri, piste da bowling, biliardo, buche del minigolf. Ogni giorno ci sono missioni dell\'hotel con premi.' },
  { title: 'Amici', text: 'Dalla lista amici vedi chi e\' online, gli scrivi in privato e lo raggiungi nella sua stanza.', target: 'Amici' },
  { title: 'Buon divertimento!', text: 'Se ti serve una mano, scrivi in chat "aiuto" vicino a un NPC. Ci vediamo in giro!' }
];

/**
 * Tutorial della prima visita: una guida che spiega i comandi un passo alla volta ed evidenzia
 * il pulsante di cui sta parlando. Si puo' saltare; alla fine non si ripresenta piu'.
 */
export default function HotelTutorial({ onDone }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];

  useEffect(() => {
    if (!current.target) return undefined;
    const button = document.querySelector(`.hotel-toolbar [title="${current.target}"]`);
    button?.classList.add('tutorial-highlight');
    return () => button?.classList.remove('tutorial-highlight');
  }, [current.target]);

  const last = step === STEPS.length - 1;
  return (
    <div className="hotel-tutorial" role="dialog" aria-label="Tutorial dell'hotel">
      <div className="hotel-tutorial-guide"><AvatarPreview look={GUIDE_LOOK} scale={2} /></div>
      <div className="hotel-tutorial-bubble">
        <span className="hotel-tutorial-count">{step + 1} / {STEPS.length}</span>
        <h3>{current.title}</h3>
        <p>{current.text}</p>
        <div className="hotel-tutorial-actions">
          {!last && <button type="button" className="btn btn-secondary btn-small" onClick={onDone}>Salta</button>}
          {step > 0 && <button type="button" className="btn btn-secondary btn-small" onClick={() => setStep(step - 1)}>Indietro</button>}
          <button type="button" className="btn btn-primary btn-small" onClick={() => (last ? onDone() : setStep(step + 1))}>
            {last ? 'Inizia!' : 'Avanti'}
          </button>
        </div>
      </div>
    </div>
  );
}
