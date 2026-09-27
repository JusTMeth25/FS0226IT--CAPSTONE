package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.Room;
import com.capstone.vinyldex.entity.RoomItem;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.RoomItemRepository;
import com.capstone.vinyldex.repository.RoomRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import com.capstone.vinyldex.service.WalletService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Mobili: acquisto, inventario, posizionamento e carte esposte.
 *
 * Qui si controlla chi puo' fare cosa (proprietario del mobile e della stanza, carta
 * posseduta). Se il mobile ci sta nella stanza lo decide invece RoomInstance, che conosce
 * avatar e altri mobili presenti in quel momento.
 */
@Service
public class FurniService {

    /** Limite all'inventario: nessuno ha bisogno di mille sedie, e protegge il database. */
    static final int MAX_ITEMS_PER_USER = 200;

    private final RoomItemRepository itemRepository;
    private final RoomRepository roomRepository;
    private final CardRepository cardRepository;
    private final UserCardRepository userCardRepository;
    private final WalletService walletService;

    public FurniService(RoomItemRepository itemRepository, RoomRepository roomRepository, CardRepository cardRepository,
                        UserCardRepository userCardRepository, WalletService walletService) {
        this.itemRepository = itemRepository;
        this.roomRepository = roomRepository;
        this.cardRepository = cardRepository;
        this.userCardRepository = userCardRepository;
        this.walletService = walletService;
    }

    private com.capstone.vinyldex.repository.UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setUserRepository(com.capstone.vinyldex.repository.UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional
    public RoomItemView buy(UUID userId, String type) {
        FurniCatalog.FurniDef def = FurniCatalog.get(type)
                .filter(FurniCatalog.FurniDef::buyable)
                .orElseThrow(() -> ApiException.badRequest("furni_not_for_sale"));
        if (itemRepository.countByOwnerId(userId) >= MAX_ITEMS_PER_USER) {
            throw ApiException.badRequest("inventory_full");
        }

        User user = walletService.adjustGold(userId, -def.price(), WalletTransactionType.FURNI_PURCHASE, def.type());
        RoomItem item = new RoomItem();
        item.setOwner(user);
        item.setFurniType(def.type());
        return RoomItemView.from(itemRepository.save(item));
    }

    /** Mobile regalato (premio di un incarico): va nell'inventario senza pagare, anche se non si compra. */
    @Transactional
    public RoomItemView grant(UUID userId, String type) {
        FurniCatalog.FurniDef def = FurniCatalog.get(type).orElseThrow(() -> ApiException.badRequest("furni_unknown"));
        RoomItem item = new RoomItem();
        item.setOwner(userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("user_not_found")));
        item.setFurniType(def.type());
        return RoomItemView.from(itemRepository.save(item));
    }

    @Transactional(readOnly = true)
    public List<RoomItemView> inventory(UUID userId) {
        return itemRepository.findInventory(userId).stream().map(RoomItemView::from).toList();
    }

    /** Il mobile, se appartiene all'utente; altrimenti errore. */
    @Transactional(readOnly = true)
    public RoomItemView ownedItem(UUID userId, UUID itemId) {
        return RoomItemView.from(ownedEntity(userId, itemId));
    }

    /**
     * Posiziona un mobile dall'inventario o lo sposta dentro la stanza.
     * Solo nella propria stanza e solo con i propri mobili.
     */
    @Transactional
    public RoomItemView place(UUID userId, UUID itemId, UUID roomId, int x, int y, int z, int rot) {
        RoomItem item = ownedEntity(userId, itemId);
        Room room = ownedRoom(userId, roomId);
        if (item.getRoom() != null && !item.getRoom().getId().equals(roomId)) {
            throw ApiException.badRequest("item_in_other_room");
        }
        item.setRoom(room);
        item.setX(x);
        item.setY(y);
        item.setZ(z);
        item.setRot(rot);
        return RoomItemView.from(itemRepository.save(item));
    }

    /** Rimette il mobile nell'inventario. La carta esposta resta montata. */
    @Transactional
    public void pickup(UUID userId, UUID itemId, UUID roomId) {
        RoomItem item = ownedEntity(userId, itemId);
        if (item.getRoom() == null || !item.getRoom().getId().equals(roomId)) {
            throw ApiException.badRequest("item_not_here");
        }
        item.setRoom(null);
        itemRepository.save(item);
    }

    /**
     * Mette una carta in vetrina (o la toglie con cardCode null).
     * Si possono esporre al massimo tante copie di una carta quante se ne possiedono.
     */
    @Transactional
    public RoomItemView setDisplay(UUID userId, UUID itemId, String cardCode) {
        RoomItem item = ownedEntity(userId, itemId);
        FurniCatalog.FurniDef def = FurniCatalog.get(item.getFurniType()).orElseThrow();
        if (!def.cardDisplay()) throw ApiException.badRequest("not_a_display");

        if (cardCode == null || cardCode.isBlank()) {
            item.setCard(null);
            return RoomItemView.from(itemRepository.save(item));
        }

        Card card = cardRepository.findByCode(cardCode).orElseThrow(() -> ApiException.notFound("card_not_found"));
        int owned = userCardRepository.findByUserIdAndCardId(userId, card.getId())
                .map(uc -> uc.getQuantity()).orElse(0);
        long displayed = itemRepository.countByOwnerIdAndCardId(userId, card.getId());
        boolean alreadyThisOne = item.getCard() != null && item.getCard().getId().equals(card.getId());
        if (owned == 0 || (!alreadyThisOne && displayed >= owned)) {
            throw ApiException.badRequest("card_not_owned");
        }

        item.setCard(card);
        return RoomItemView.from(itemRepository.save(item));
    }

    private RoomItem ownedEntity(UUID userId, UUID itemId) {
        RoomItem item = itemRepository.findWithDetails(itemId).orElseThrow(() -> ApiException.notFound("item_not_found"));
        if (item.getOwner() == null || !item.getOwner().getId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "not_your_item");
        }
        return item;
    }

    private Room ownedRoom(UUID userId, UUID roomId) {
        Room room = roomRepository.findWithOwner(roomId).orElseThrow(() -> ApiException.notFound("room_not_found"));
        if (room.getOwner() == null || !room.getOwner().getId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "not_your_room");
        }
        return room;
    }
}
