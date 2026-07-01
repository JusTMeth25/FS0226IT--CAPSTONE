/**
 * Weighted random selection (drop rate), shuffle e utilità random condivise.
 */

export function weightedRandom(choices) {
  if (!choices || choices.length === 0) return null;

  const totalWeight = choices.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight <= 0) {
    return choices[Math.floor(Math.random() * choices.length)].item;
  }

  let random = Math.random() * totalWeight;
  for (const choice of choices) {
    random -= choice.weight;
    if (random <= 0) return choice.item;
  }
  return choices[choices.length - 1].item;
}

export function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomItem(array) {
  if (!array || array.length === 0) return null;
  return array[Math.floor(Math.random() * array.length)];
}
