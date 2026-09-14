/**
 * Testo attraversato da un riflesso che scorre, per il marchio e le etichette premium.
 *
 * Il riflesso e' un gradiente ritagliato sul testo: non serve nessun elemento sovrapposto,
 * quindi la selezione del testo e la lettura da parte degli screen reader restano intatte.
 */
export default function ShinyText({ children, speed = 4, className = '', as: Tag = 'span' }) {
  return (
    <Tag className={`shiny-text ${className}`} style={{ '--shine-duration': `${speed}s` }}>
      {children}
    </Tag>
  );
}
