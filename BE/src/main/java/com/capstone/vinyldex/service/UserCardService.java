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

    /** Prima edizione: una carta appena trovata a volte e' una delle dieci copie numerate. */
    private CollectionExtrasService extras;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setExtras(@org.springframework.context.annotation.Lazy CollectionExtrasService extras) {
        this.extras = extras;
    }

    /** Aggiunge copie, creando la riga di collezione se l'utente non aveva ancora la carta. */
    @Transactional(propagation = Propagation.MANDATORY)
    public UserCard add(User user, Card card, int quantity) {
        UserCard userCard = userCardRepository.findByUserIdAndCardId(user.getId(), card.getId())
                .orElseGet(() -> new UserCard(user, card, 0));
        boolean firstCopy = userCard.getQuantity() == 0;
        userCard.setQuantity(userCard.getQuantity() + quantity);
        userCard.setObtainedAt(Instant.now());
        UserCard saved = userCardRepository.save(userCard);
        // Ogni carta nuova ha una piccola probabilita' di essere una copia numerata di prima edizione.
        if (firstCopy && extras != null && card.getId() != null) extras.maybeClaimFirstEdition(user.getId(), card);
        return saved;
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
