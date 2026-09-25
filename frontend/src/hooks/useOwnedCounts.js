import { useMemo } from 'react';
import { useGame } from './useGame.js';
import { dedupeCollection } from '../utils/collectionUtils.js';

/** Copie possedute per carta (id -> quantita'), per dire negli scambi quante ne hai gia'. */
export function useOwnedCounts() {
  const { collection } = useGame();
  return useMemo(
    () => new Map(dedupeCollection(collection).map((card) => [card.id, card.quantity ?? 1])),
    [collection]
  );
}
