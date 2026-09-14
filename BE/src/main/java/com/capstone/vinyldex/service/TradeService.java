package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.request.GameRequests;
import com.capstone.vinyldex.dto.response.TradeDto;
import com.capstone.vinyldex.entity.*;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.TradeItemRepository;
import com.capstone.vinyldex.repository.TradeRepository;
import com.capstone.vinyldex.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Scambi diretti fra due giocatori.
 *
 * Quello che offre chi propone finisce subito in deposito: le carte escono dalla sua collezione
 * e i gold offerti vengono addebitati alla creazione. Se la proposta viene rifiutata o annullata
 * tutto torna indietro. Cosi' chi propone non puo' offrire due volte le stesse carte ne' spendere
 * altrove i gold gia' promessi.
 *
 * Quello che viene richiesto non e' in deposito: si verifica soltanto all'accettazione, perche'
 * bloccare le carte di un utente che non ha ancora detto di si' sarebbe scorretto.
 */
@Service
public class TradeService {

    private final TradeRepository tradeRepository;
    private final TradeItemRepository tradeItemRepository;
    private final CardRepository cardRepository;
    private final UserRepository userRepository;
    private final UserCardService userCardService;
    private final WalletService walletService;

    public TradeService(TradeRepository tradeRepository,
                        TradeItemRepository tradeItemRepository,
                        CardRepository cardRepository,
                        UserRepository userRepository,
                        UserCardService userCardService,
                        WalletService walletService) {
        this.tradeRepository = tradeRepository;
        this.tradeItemRepository = tradeItemRepository;
        this.cardRepository = cardRepository;
        this.userRepository = userRepository;
        this.userCardService = userCardService;
        this.walletService = walletService;
    }

    @Transactional
    public TradeDto create(UUID fromUserId, GameRequests.TradeCreateRequest request) {
        User fromUser = userRepository.findById(fromUserId)
                .orElseThrow(() -> ApiException.notFound("user_not_found"));

        User toUser = userRepository.findByUsernameOrId(request.toUserId())
                .orElseThrow(() -> ApiException.notFound("recipient_not_found"));

        if (toUser.getId().equals(fromUserId)) {
            throw ApiException.badRequest("cannot_trade_with_yourself");
        }

        Trade trade = new Trade();
        trade.setFromUser(fromUser);
        trade.setToUser(toUser);
        trade.setOfferedGold(request.offeredGoldOrZero());
        trade.setRequestedGold(request.requestedGoldOrZero());
        tradeRepository.save(trade);

        for (GameRequests.TradeCardRequest item : request.offeredOrEmpty()) {
            Card card = resolveCard(item.cardId());
            int quantity = item.quantityOrOne();
            userCardService.remove(fromUser, card, quantity);
            addItem(trade, card, quantity, TradeItemDirection.OFFERED);
        }

        for (GameRequests.TradeCardRequest item : request.requestedOrEmpty()) {
            Card card = resolveCard(item.cardId());
            addItem(trade, card, item.quantityOrOne(), TradeItemDirection.REQUESTED);
        }

        if (trade.getOfferedGold() > 0) {
            walletService.adjustGold(fromUserId, -trade.getOfferedGold(),
                    WalletTransactionType.TRADE, trade.getId().toString(), "escrow");
        }

        return TradeDto.from(reload(trade.getId()));
    }

    @Transactional(readOnly = true)
    public List<TradeDto> incoming(UUID userId) {
        return tradeRepository.findIncoming(userId).stream().map(TradeDto::from).toList();
    }

    @Transactional(readOnly = true)
    public List<TradeDto> outgoing(UUID userId) {
        return tradeRepository.findOutgoing(userId).stream().map(TradeDto::from).toList();
    }

    /** Accetta la proposta. Solo il destinatario puo' farlo. */
    @Transactional
    public TradeDto accept(UUID userId, UUID tradeId) {
        Trade trade = loadPending(tradeId);
        if (!trade.getToUser().getId().equals(userId)) {
            throw ApiException.forbidden("forbidden");
        }

        User receiver = trade.getToUser();
        User proposer = trade.getFromUser();

        List<TradeItem> requested = itemsOf(trade, TradeItemDirection.REQUESTED);
        List<TradeItem> offered = itemsOf(trade, TradeItemDirection.OFFERED);

        // Prima si verifica tutto, poi si sposta: uno scambio a meta' lascerebbe
        // un giocatore senza carte e senza contropartita.
        for (TradeItem item : requested) {
            if (!userCardService.owns(receiver, item.getCard(), item.getQuantity())) {
                throw ApiException.badRequest("insufficient_quantity_or_gold");
            }
        }

        for (TradeItem item : requested) {
            userCardService.remove(receiver, item.getCard(), item.getQuantity());
            userCardService.add(proposer, item.getCard(), item.getQuantity());
        }

        // Le carte offerte sono gia' in deposito: al destinatario basta accreditarle.
        for (TradeItem item : offered) {
            userCardService.add(receiver, item.getCard(), item.getQuantity());
        }

        String relatedId = trade.getId().toString();
        if (trade.getRequestedGold() > 0) {
            walletService.adjustGold(receiver.getId(), -trade.getRequestedGold(), WalletTransactionType.TRADE, relatedId);
            walletService.adjustGold(proposer.getId(), trade.getRequestedGold(), WalletTransactionType.TRADE, relatedId);
        }
        if (trade.getOfferedGold() > 0) {
            walletService.adjustGold(receiver.getId(), trade.getOfferedGold(), WalletTransactionType.TRADE, relatedId);
        }

        trade.setStatus(TradeStatus.ACCEPTED);
        tradeRepository.save(trade);
        return TradeDto.from(reload(trade.getId()));
    }

    /** Rifiuta la proposta. Solo il destinatario puo' farlo. */
    @Transactional
    public TradeDto reject(UUID userId, UUID tradeId) {
        Trade trade = loadPending(tradeId);
        if (!trade.getToUser().getId().equals(userId)) {
            throw ApiException.forbidden("forbidden");
        }
        refundEscrow(trade);
        trade.setStatus(TradeStatus.REJECTED);
        tradeRepository.save(trade);
        return TradeDto.from(reload(trade.getId()));
    }

    /** Annulla la proposta. Solo chi l'ha inviata puo' farlo. */
    @Transactional
    public TradeDto cancel(UUID userId, UUID tradeId) {
        Trade trade = loadPending(tradeId);
        if (!trade.getFromUser().getId().equals(userId)) {
            throw ApiException.forbidden("forbidden");
        }
        refundEscrow(trade);
        trade.setStatus(TradeStatus.CANCELLED);
        tradeRepository.save(trade);
        return TradeDto.from(reload(trade.getId()));
    }

    /**
     * Salva la riga e la aggiunge anche alla collezione in memoria.
     *
     * Senza il secondo passaggio l'oggetto Trade appena creato resta con la lista vuota: una
     * rilettura nella stessa transazione riceve la stessa istanza dalla cache di primo livello,
     * quindi la risposta tornerebbe senza le carte scambiate.
     */
    private void addItem(Trade trade, Card card, int quantity, TradeItemDirection direction) {
        TradeItem item = tradeItemRepository.save(new TradeItem(trade, card, quantity, direction));
        trade.getItems().add(item);
    }

    /** Restituisce a chi ha proposto le carte e i gold messi in deposito alla creazione. */
    private void refundEscrow(Trade trade) {
        for (TradeItem item : itemsOf(trade, TradeItemDirection.OFFERED)) {
            userCardService.add(trade.getFromUser(), item.getCard(), item.getQuantity());
        }
        if (trade.getOfferedGold() > 0) {
            walletService.adjustGold(trade.getFromUser().getId(), trade.getOfferedGold(),
                    WalletTransactionType.TRADE, trade.getId().toString(), "refund");
        }
    }

    private List<TradeItem> itemsOf(Trade trade, TradeItemDirection direction) {
        return trade.getItems().stream().filter(item -> item.getDirection() == direction).toList();
    }

    private Trade loadPending(UUID tradeId) {
        return tradeRepository.findByIdWithItems(tradeId)
                .filter(t -> t.getStatus() == TradeStatus.PENDING)
                .orElseThrow(() -> ApiException.notFound("trade_not_available"));
    }

    private Trade reload(UUID tradeId) {
        return tradeRepository.findByIdWithItems(tradeId)
                .orElseThrow(() -> ApiException.notFound("trade_not_available"));
    }

    private Card resolveCard(String publicId) {
        return cardRepository.findByCode(publicId)
                .orElseThrow(() -> ApiException.notFound("card_not_found"));
    }
}
