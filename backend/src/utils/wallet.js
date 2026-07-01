/**
 * Helper per movimenti gold, sempre dentro una transazione Prisma (tx) e sempre
 * loggati in UserWalletTransaction. Non fidarsi mai del saldo passato dal client:
 * questo helper rilegge sempre il saldo corrente dal DB prima di applicare il delta.
 */

class InsufficientGoldError extends Error {
  constructor(message = 'insufficient_gold') {
    super(message);
    this.name = 'InsufficientGoldError';
  }
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} userId
 * @param {number} delta - positivo per accredito, negativo per addebito
 * @param {string} type - WalletTransactionType
 * @param {{ relatedId?: string, note?: string }} [opts]
 */
async function adjustGold(tx, userId, delta, type, opts = {}) {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('user_not_found');

  const nextGold = user.gold + delta;
  if (nextGold < 0) throw new InsufficientGoldError();

  const updated = await tx.user.update({ where: { id: userId }, data: { gold: nextGold } });
  await tx.userWalletTransaction.create({
    data: {
      userId,
      amount: delta,
      type,
      balanceAfter: updated.gold,
      relatedId: opts.relatedId || null,
      note: opts.note || null
    }
  });
  return updated;
}

module.exports = { adjustGold, InsufficientGoldError };
