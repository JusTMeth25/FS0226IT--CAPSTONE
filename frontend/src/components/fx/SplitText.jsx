import { useMemo } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';

/**
 * Testo che entra una lettera alla volta.
 *
 * Ogni carattere sta in uno span con un ritardo crescente. Il testo completo resta
 * disponibile in aria-label e i singoli span sono nascosti agli screen reader, altrimenti
 * verrebbe letto lettera per lettera.
 *
 * Gli spazi diventano spazi unificatori: uno span contenente solo uno spazio normale
 * verrebbe collassato dal browser e le parole si attaccherebbero.
 */
export default function SplitText({ text, delay = 28, className = '', as: Tag = 'span' }) {
  const reduced = useReducedMotion();

  const characters = useMemo(() => Array.from(String(text ?? '')), [text]);

  if (reduced) {
    return <Tag className={className}>{text}</Tag>;
  }

  return (
    <Tag className={`split-text ${className}`} aria-label={text}>
      {characters.map((char, index) => (
        <span
          key={`${char}-${index}`}
          className="split-text-char"
          aria-hidden="true"
          style={{ animationDelay: `${index * delay}ms` }}
        >
          {char === ' ' ? ' ' : char}
        </span>
      ))}
    </Tag>
  );
}
