const prisma = require('../../prismaClient');

/** Upserta le carte normalizzate (una singola call per source) e aggiorna ExternalCardSource. */
async function persistImportedCards(source, normalizedCards, errorMessage = null) {
  let imported = 0;
  for (const c of normalizedCards) {
    await prisma.card.upsert({
      where: { source_externalId: { source, externalId: c.externalId } },
      update: {
        name: c.name, rarity: c.rarity, imgUrl: c.imgUrl, description: c.description,
        setName: c.setName, setCode: c.setCode, number: c.number, metadata: c.metadata,
        code: c.code
      },
      create: {
        code: c.code, source, externalId: c.externalId, name: c.name, rarity: c.rarity,
        imgUrl: c.imgUrl, description: c.description, setName: c.setName, setCode: c.setCode,
        number: c.number, metadata: c.metadata,
        // Le carte importate partono con stat neutre: un admin può bilanciarle manualmente dal pannello.
        fans: 50, style: 50, influence: 50, energy: 50
      }
    });
    imported++;
  }

  await prisma.externalCardSource.upsert({
    where: { source },
    update: { lastImportedAt: new Date(), totalImported: { increment: imported }, lastError: errorMessage },
    create: { source, lastImportedAt: new Date(), totalImported: imported, lastError: errorMessage }
  });

  return imported;
}

module.exports = { persistImportedCards };
