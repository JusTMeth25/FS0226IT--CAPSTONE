package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserWalletTransaction;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.repository.UserWalletTransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Unico punto da cui passano i gold.
 *
 * Due regole che non vanno aggirate:
 *   1. il saldo si rilegge sempre dal database, mai dal client e mai da un'entita' in cache;
 *   2. ogni variazione lascia una riga in user_wallet_transactions.
 *
 * La propagazione e' MANDATORY: un movimento isolato non ha senso, deve sempre stare dentro
 * la transazione dell'operazione che lo ha causato (acquisto, apertura, scambio).
 */
@Service
public class WalletService {

    private final UserRepository userRepository;
    private final UserWalletTransactionRepository transactionRepository;

    public WalletService(UserRepository userRepository,
                         UserWalletTransactionRepository transactionRepository) {
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
    }

    /**
     * Applica un delta al saldo e registra il movimento.
     *
     * @param delta positivo per accredito, negativo per addebito
     * @throws ApiException 402 se il saldo scenderebbe sotto zero
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public User adjustGold(UUID userId, int delta, WalletTransactionType type, String relatedId, String note) {
        User user = userRepository.findByIdForUpdate(userId)
                .orElseThrow(() -> ApiException.notFound("user_not_found"));

        int nextGold = user.getGold() + delta;
        if (nextGold < 0) {
            throw ApiException.insufficientGold();
        }

        user.setGold(nextGold);
        userRepository.save(user);

        UserWalletTransaction tx = new UserWalletTransaction();
        tx.setUser(user);
        tx.setAmount(delta);
        tx.setType(type);
        tx.setBalanceAfter(nextGold);
        tx.setRelatedId(relatedId);
        tx.setNote(note);
        transactionRepository.save(tx);

        return user;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public User adjustGold(UUID userId, int delta, WalletTransactionType type) {
        return adjustGold(userId, delta, type, null, null);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public User adjustGold(UUID userId, int delta, WalletTransactionType type, String relatedId) {
        return adjustGold(userId, delta, type, relatedId, null);
    }
}
