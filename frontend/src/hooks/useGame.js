import { useContext } from 'react';
import { GameContext } from '../context/game-context.js';

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame deve essere usato dentro <GameProvider>');
  return ctx;
}
