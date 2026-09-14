import { useCountUp } from '../../hooks/useCountUp.js';

/**
 * Numero che sale invece di cambiare di scatto.
 *
 * Avvolge useCountUp, che era gia' in uso solo per il gold nella barra in alto: qui diventa
 * riutilizzabile ovunque compaia una statistica.
 *
 * Un valore non numerico viene mostrato com'e': le statistiche possono arrivare vuote o
 * nulle mentre i dati sono ancora in caricamento.
 */
export default function AnimatedNumber({ value, duration = 700, className = '' }) {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const display = useCountUp(numeric ? value : 0, duration);

  if (!numeric) {
    return <span className={className}>{value ?? 0}</span>;
  }

  return <span className={className}>{display}</span>;
}
