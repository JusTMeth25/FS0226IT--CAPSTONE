import { useEffect, useState } from 'react';
import { hasUnseenNews } from '../data/news.js';

/** Vero finche' l'utente non ha aperto la pagina Novita' dopo l'ultima uscita. */
export function useUnseenNews() {
  const [unseen, setUnseen] = useState(hasUnseenNews);
  useEffect(() => {
    const update = () => setUnseen(hasUnseenNews());
    window.addEventListener('vinyldex-news-seen', update);
    return () => window.removeEventListener('vinyldex-news-seen', update);
  }, []);
  return unseen;
}
