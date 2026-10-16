import { useEffect } from 'react';
import { AnimatePresence, m } from 'motion/react';
import StarBurst from '../phantom/StarBurst.jsx';

/**
 * Il "colpo riuscito" di Mercato e Scambi: una striscia bianca col bordo magenta entra di scatto
 * in alto e se ne va da sola dopo qualche secondo (o col pulsante). Solo esito grafico di
 * un'azione gia' conclusa: la regione e' sempre nel DOM, cosi' i lettori di schermo la annunciano.
 *
 * deal: un oggetto di newDeal(title, text) oppure null. onDone: chiamata alla chiusura.
 */
export default function DealBanner({ deal, onDone }) {
  useEffect(() => {
    if (!deal) return undefined;
    const timer = setTimeout(onDone, 4200);
    return () => clearTimeout(timer);
  }, [deal, onDone]);

  return (
    <div className="sp-deal" role="status" aria-live="polite">
      <AnimatePresence>
        {deal && (
          <m.div
            key={deal.id}
            className="sp-deal-inner"
            initial={{ x: '-40%', opacity: 0, rotate: -4 }}
            animate={{ x: 0, opacity: 1, rotate: -1.5 }}
            exit={{ x: '30%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 560, damping: 26 }}
          >
            <StarBurst size={56} className="sp-deal-star" />
            <div className="sp-deal-text">
              <p className="sp-deal-title">{deal.title}</p>
              <p className="sp-deal-desc">{deal.text}</p>
            </div>
            <button type="button" className="sp-deal-close" onClick={onDone} aria-label="Chiudi l'avviso">
              <i className="ph ph-x" aria-hidden="true" />
            </button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
