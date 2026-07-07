/**
 * Motore missioni server-side. Il progresso è sempre calcolato/validato qui,
 * mai accettato dal client. Le missioni "isDaily" si resettano pigramente al
 * primo evento del nuovo giorno (nessun cron necessario).
 */

function isNewDay(date) {
  if (!date) return true;
  const now = new Date();
  return date.toDateString() !== now.toDateString();
}

async function getOrCreateUserMission(tx, userId, mission) {
  let um = await tx.userMission.findUnique({ where: { userId_missionId: { userId, missionId: mission.id } } });
  if (!um) {
    um = await tx.userMission.create({ data: { userId, missionId: mission.id, progress: 0 } });
  } else if (mission.isDaily && um.claimed && isNewDay(um.completedAt || um.startedAt)) {
    um = await tx.userMission.update({
      where: { id: um.id },
      data: { progress: 0, completed: false, claimed: false, startedAt: new Date(), completedAt: null }
    });
  }
  return um;
}

async function bumpMission(tx, userId, mission, amount) {
  const um = await getOrCreateUserMission(tx, userId, mission);
  if (um.claimed) return um; // già reclamata in questo ciclo, non riaccumulare
  const progress = Math.min(um.progress + amount, mission.targetValue);
  const completed = progress >= mission.targetValue;
  return tx.userMission.update({
    where: { id: um.id },
    data: { progress, completed, completedAt: completed && !um.completed ? new Date() : um.completedAt }
  });
}

async function setMissionValue(tx, userId, mission, value) {
  const um = await getOrCreateUserMission(tx, userId, mission);
  if (um.claimed) return um;
  const progress = Math.min(value, mission.targetValue);
  const completed = progress >= mission.targetValue;
  if (progress === um.progress && completed === um.completed) return um;
  return tx.userMission.update({
    where: { id: um.id },
    data: { progress, completed, completedAt: completed && !um.completed ? new Date() : um.completedAt }
  });
}

/**
 * Da chiamare dopo eventi puntuali (apertura pacchetto, vendita/acquisto mercato).
 * @param {string} type - 'open_packs' | 'collect_cards' | 'collect_rarity' | 'sell_market' | 'buy_market'
 * @param {number} amount
 * @param {{ rarity?: string }} [context]
 */
async function incrementMissionsByType(tx, userId, type, amount, context = {}) {
  const missions = await tx.mission.findMany({ where: { type, isActive: true } });
  for (const mission of missions) {
    if (type === 'collect_rarity') {
      if (!mission.metadata || mission.metadata.rarity !== context.rarity) continue;
    }
    await bumpMission(tx, userId, mission, amount);
  }
}

/**
 * Da chiamare dopo ogni variazione della collezione: ricalcola le missioni il cui
 * progresso è un valore assoluto (non un contatore incrementale).
 */
async function recomputeAbsoluteMissions(tx, userId) {
  const uniqueCount = await tx.userCard.count({ where: { userId } });

  const uniqueMissions = await tx.mission.findMany({ where: { type: 'collect_cards_unique', isActive: true } });
  for (const mission of uniqueMissions) {
    await setMissionValue(tx, userId, mission, uniqueCount);
  }

  const albumMissions = await tx.mission.findMany({ where: { type: 'album_percent', isActive: true } });
  if (albumMissions.length) {
    // Totale reale del catalogo (tutte le fonti): AlbumCard resta fermo alle 43 carte del seed
    // e non riflette le carte importate da API esterne, gonfiando la percentuale oltre il 100%.
    const totalActiveCards = await tx.card.count({ where: { isActive: true } });
    const percent = totalActiveCards > 0 ? Math.round((uniqueCount / totalActiveCards) * 100) : 0;
    for (const mission of albumMissions) {
      await setMissionValue(tx, userId, mission, percent);
    }
  }
}

module.exports = { incrementMissionsByType, recomputeAbsoluteMissions, getOrCreateUserMission, isNewDay };
