/**
 * Stella a cinque punte con contorno spesso e ombra netta, l'accento grafico di P5: si usa per
 * vittorie, premi, badge "Nuovo!" e come decorazione delle copertine. Solo decorativa.
 */
export default function StarBurst({ size = 48, fill = 'var(--neon-magenta)', stroke = '#fff', inner = true, className = '', style }) {
  return (
    <svg className={`p5-star ${className}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false" style={style}>
      <polygon points="50,4 62,36 97,38 69,60 79,95 50,74 21,95 31,60 3,38 38,36" fill="#000" transform="translate(5 5)" />
      <polygon points="50,4 62,36 97,38 69,60 79,95 50,74 21,95 31,60 3,38 38,36" fill={fill} stroke={stroke} strokeWidth="6" strokeLinejoin="miter" />
      {/* Stella interna: si toglie quando dentro va scritto qualcosa (il livello). */}
      {inner && <polygon points="50,26 56,43 74,44 60,55 65,73 50,62 35,73 40,55 26,44 44,43" fill="none" stroke={stroke} strokeWidth="3" />}
    </svg>
  );
}
