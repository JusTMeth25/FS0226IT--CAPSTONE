/** Risolve una carta dal suo id pubblico (= Card.code) usato dal frontend. */
async function resolveCardByPublicId(client, publicId) {
  return client.card.findUnique({ where: { code: publicId } });
}

module.exports = { resolveCardByPublicId };
