import { useEffect, useState } from 'react';

/** Pulsante flottante "torna su": compare solo dopo aver scrollato oltre una soglia. */
export default function ScrollToTopButton({ threshold = 400 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > threshold);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  if (!visible) return null;

  return (
    <button
      className="scroll-to-top-btn"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Torna su"
      title="Torna su"
    >
      <i className="ph-fill ph-arrow-up" />
    </button>
  );
}
