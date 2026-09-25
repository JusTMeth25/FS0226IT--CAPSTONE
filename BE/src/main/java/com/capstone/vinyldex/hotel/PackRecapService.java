package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.Pack;
import com.capstone.vinyldex.entity.PackOpening;
import com.capstone.vinyldex.entity.PackOpeningCard;
import com.capstone.vinyldex.repository.PackOpeningRepository;
import com.capstone.vinyldex.repository.PackRepository;
import com.capstone.vinyldex.service.PackGenerator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Riepilogo di un pacchetto aperto nell'hotel: quanto valgono le carte uscite e la miniatura
 * della piu' costosa, mostrati sopra l'avatar a tutta la stanza.
 *
 * Per i giocatori il riepilogo si ricava dall'ultima apertura salvata nel database, non da cio'
 * che manda il browser: nessuno puo' vantarsi di una leggendaria mai trovata. Anche gli NPC ogni
 * tanto aprono un pacchetto: le carte si pescano con le stesse regole, ma non si salvano.
 */
@Service
public class PackRecapService {

    private static final Logger log = LoggerFactory.getLogger(PackRecapService.class);

    /** L'apertura da annunciare deve essere recente: chi apre dalla pagina Pacchetti non conta. */
    static final long RECENT_MILLIS = 10 * 60_000;
    /** Chi apre pacchetti fra gli NPC: gli ospiti e gli sfidanti, non chi lavora. */
    private static final Set<NpcRoster.Role> OPENERS = Set.of(NpcRoster.Role.GUEST, NpcRoster.Role.FIGHTER);

    private final PackOpeningRepository openingRepository;
    private final PackRepository packRepository;
    private final PackGenerator packGenerator;
    private final RoomRegistry registry;
    private final SecureRandom random = new SecureRandom();
    /** Ultima apertura gia' annunciata per giocatore: la stessa non si ripete. */
    private final Map<UUID, UUID> announced = new ConcurrentHashMap<>();

    public PackRecapService(PackOpeningRepository openingRepository, PackRepository packRepository,
                            PackGenerator packGenerator, RoomRegistry registry) {
        this.openingRepository = openingRepository;
        this.packRepository = packRepository;
        this.packGenerator = packGenerator;
        this.registry = registry;
    }

    /** Il giocatore ha finito di guardare il pacchetto: la stanza vede il riepilogo. */
    @Transactional(readOnly = true)
    public String announceLatest(HotelSession session, RoomInstance room) {
        UUID userId = session.user().id();
        Instant after = Instant.now().minusMillis(RECENT_MILLIS);
        PackOpening opening = openingRepository.findRecentOfUser(userId, after).stream().findFirst().orElse(null);
        if (opening == null || opening.getId().equals(announced.get(userId))) return "no_recent_pack";
        announced.put(userId, opening.getId());
        List<Card> cards = opening.getCards().stream().map(PackOpeningCard::getCard).toList();
        room.announce(recap(userId, session.user().username(), opening.getPack(), cards, false));
        return null;
    }

    /** Ogni tanto, in una stanza pubblica con giocatori, un NPC apre un pacchetto. */
    @Scheduled(fixedDelay = 50_000, initialDelay = 70_000)
    @Transactional(readOnly = true)
    public void npcOpenings() {
        List<Pack> packs = null;
        for (UUID roomId : NpcRoster.rooms()) {
            RoomInstance room = registry.get(roomId);
            if (room == null || room.activePlayers().isEmpty() || random.nextInt(5) != 0) continue;
            List<UUID> openers = room.npcsWithRole(OPENERS);
            if (openers.isEmpty()) continue;
            if (packs == null) packs = packRepository.findAllActiveWithRates();
            if (packs.isEmpty()) return;
            try {
                UUID npcId = openers.get(random.nextInt(openers.size()));
                HotelUser npc = room.npcUser(npcId);
                if (npc == null) continue;
                Pack pack = packs.get(random.nextInt(packs.size()));
                List<Card> cards = packGenerator.generate(pack);
                if (cards.isEmpty()) continue;
                room.announce(recap(npcId, npc.username(), pack, cards, true));
                Card top = top(cards);
                room.npcSay(npcId, NpcDialog.packOpened(pack.getName(), top.getName(), random), null);
            } catch (RuntimeException ex) {
                log.warn("Pacchetto di un NPC non riuscito: {}", ex.getMessage());
            }
        }
    }

    /** La carta piu' preziosa: prezzo di mercato, a parita' la rarita' piu' alta. */
    static Card top(List<Card> cards) {
        return cards.stream()
                .max(Comparator.comparingDouble((Card c) -> c.getMarketPrice() == null ? 0 : c.getMarketPrice())
                        .thenComparingInt(c -> HotelSocialService.RARITY_ORDER.getOrDefault(c.getRarity(), 0)))
                .orElseThrow();
    }

    static double total(List<Card> cards) {
        double total = cards.stream().mapToDouble(c -> c.getMarketPrice() == null ? 0 : c.getMarketPrice()).sum();
        return Math.round(total * 100) / 100.0;
    }

    static Map<String, Object> recap(UUID id, String username, Pack pack, List<Card> cards, boolean npc) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("type", "pack_recap");
        message.put("id", id);
        message.put("username", username);
        message.put("pack", pack.getName());
        message.put("count", cards.size());
        message.put("total", total(cards));
        message.put("top", RoomItemView.CardView.from(top(cards)));
        message.put("npc", npc);
        return message;
    }
}
