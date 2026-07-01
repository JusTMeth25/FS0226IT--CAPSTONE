import { useContext } from 'react';
import { SoundContext } from '../context/sound-context.js';

export function useSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useSound deve essere usato dentro <SoundProvider>');
  return ctx;
}
