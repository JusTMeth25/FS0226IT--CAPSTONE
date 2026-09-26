package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserCard;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserCardRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Movimenti di carte fra collezioni.
 *
 * Vive qui e non nei singoli servizi perche' pacchetti, mercato e scambi devono
 * aggiungere e togliere copie nello stesso identico modo.
 */
@Service
public class UserCardService {

    private final UserCardRepository userCardRepository;

    public UserCardService(UserCardRepository userCardRepository) {
        this.userCardRepository = userCardRepository;
    }

    /** Aggiunge copie, creando la riga di collezione se l'utente non aveva ancora la carta. */
    @Transactional(propagation = Propagation.MANDATORY)
    public UserCard add(User user, Card card, int quantity) {
        UserCard userCard = userCardRepository.findByUserIdAndCardId(user.getId(), card.getId())
                .orElseGet(() -> new UserCard(user, card, 0));
        userCard.setQuantity(userCard.getQuantity() + quantity);
        userCard.setObtainedAt(Instant.now());
        return userCardRepository.save(userCard);
    }

    /**
     * Toglie copie dalla collezione.
     *
     * @throws ApiException 400 insufficient_quantity se l'utente non possiede abbastanza copie
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public UserCard remove(User user, Card card, int quantity) {
        UserCard userCard = userCardRepository.findByUserIdAndCardId(user.getId(), card.getId())
                .filter(uc -> uc.getQuantity() >= quantity)
                .orElseThrow(() -> ApiException.badRequest("insufficient_quantity"));

        userCard.setQuantity(userCard.getQuantity() - quantity);
        // Si danno via prima le copie normali: le olografiche restano finche' ce ne sono.
        userCard.setFoilCount(Math.min(userCard.getFoilCount(), userCard.getQuantity()));
        return userCardRepository.save(userCard);
    }

    /** Aggiunge una copia olografica (dai pacchetti). */
    @Transactional(propagation = Propagation.MANDATORY)
    public UserCard addFoil(User user, Card card) {
        UserCard userCard = add(user, card, 1);
        userCard.setFoilCount(userCard.getFoilCount() + 1);
        return userCardRepository.save(userCard);
    }

    /** Vero se l'utente possiede almeno il numero di copie indicato. */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean owns(User user, Card card, int quantity) {
        return userCardRepository.findByUserIdAndCardId(user.getId(), card.getId())
                .map(uc -> uc.getQuantity() >= quantity)
                .orElse(false);
    }
}
