import { createContext, useContext } from 'react';

export const HotelContext = createContext(null);

/** Connessione all'hotel condivisa da tutta l'app (vedi HotelProvider). */
export function useHotel() {
  const ctx = useContext(HotelContext);
  if (!ctx) throw new Error('useHotel deve essere usato dentro <HotelProvider>');
  return ctx;
}
