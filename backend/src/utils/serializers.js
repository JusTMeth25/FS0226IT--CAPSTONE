/**
 * Serializzatori DTO condivisi tra le route.
 *
 * Nota: il campo pubblico `id` di una carta è il suo `code` (es. "showman-001"),
 * non lo uuid interno della riga Prisma. Il codice è stabile e leggibile, ed è
 * lo stesso formato già usato dal frontend per i dati locali/demo, così le due
 * fonti restano intercambiabili senza rimappare gli id lato client.
 */

function serializeCard(card) {
  if (!card) return null;
  return {
    id: card.code,
    name: card.name,
    artistClass: card.artistClass?.name || null,
    variant: card.variant,
    group: card.group || null,
    rarity: card.rarity,
    img: card.imgUrl || '',
    fullImage: card.fullImage,
    stats: {
      fans: card.fans,
      style: card.style,
      influence: card.influence,
      energy: card.energy
    },
    description: card.description,
    source: card.source,
    setName: card.setName || null,
    setCode: card.setCode || null,
    number: card.number || null
  };
}

function serializeUserCard(userCard) {
  return {
    ...serializeCard(userCard.card),
    obtainedAt: userCard.obtainedAt,
    isFavorite: userCard.isFavorite,
    quantity: userCard.quantity
  };
}

function serializePublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    gold: user.gold,
    xp: user.xp,
    level: user.level,
    role: user.role,
    banned: user.banned,
    createdAt: user.createdAt
  };
}

module.exports = { serializeCard, serializeUserCard, serializePublicUser };
