import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './useAuth.js';
import { extrasApi } from '../services/extrasApi.js';

/**
 * Quante carte della lista dei desideri si possono prendere adesso (mercato, banchetti, NPC).
 * Si ricontrolla cambiando pagina e ogni due minuti: basta per un avviso nel menu.
 */
export function useWishAlerts() {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    const check = () => extrasApi.wishlist().then((res) => { if (!cancelled) setCount(res.available || 0); }).catch(() => {});
    check();
    const timer = setInterval(check, 120_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [isAuthenticated, pathname]);

  return isAuthenticated ? count : 0;
}
