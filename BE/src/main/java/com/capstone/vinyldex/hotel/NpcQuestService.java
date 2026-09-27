package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.dto.response.CardDto;
import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserCard;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.RoomRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import com.capstone.vinyldex.service.UserCardService;
import com.capstone.vinyldex.service.WalletService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

/**
 * Incarichi degli NPC: ogni giorno tre personaggi dell'hotel chiedono una carta ("portami una
 * rara di One Piece"). Chi la consegna riceve gold e, per le richieste piu' difficili, un mobile
 * raro. Gli incarichi sono gli stessi per tutti; ognuno puo' completarli una volta al giorno.
 */
@Service
public class NpcQuestService {

    static final ZoneId ZONE = ZoneId.of("Europe/Rome");
    public static final int QUESTS_PER_DAY = 3;
    static final List<String> SOURCES = List.of("pokemon", "yugioh", "scryfall", "onepiece", "digimon", "dragonball",
            "lorcana", "gundam", "riftbound", "nikke", "fc27", "original");
    static final Map<String, String> SOURCE_NAMES = Map.ofEntries(
            Map.entry("pokemon", "Pokémon"), Map.entry("yugioh", "Yu-Gi-Oh!"), Map.entry("scryfall", "Magic"),
            Map.entry("onepiece", "One Piece"), Map.entry("digimon", "Digimon"), Map.entry("dragonball", "Dragon Ball"),
            Map.entry("lorcana", "Lorcana"), Map.entry("gundam", "Gundam"), Map.entry("riftbound", "Riftbound"), Map.entry("nikke", "NIKKE"),
            Map.entry("fc27", "EA FC 27"), Map.entry("original", "VinylDex"));
    static final List<String> RARITY_ORDER = List.of("common", "uncommon", "rare", "epic", "legendary");
    static final Map<String, String> RARITY_NAMES = Map.of("uncommon", "non comune", "rare", "rara", "epic", "epica");
    static final Map<String, Integer> REWARDS = Map.of("uncommon", 45, "rare", 100, "epic", 220);
    /** Per le richieste epiche, oltre ai gold, un mobile che non si compra: la teca 3D. */
    static final String RARE_FURNI = "card_case";

    /** Un incarico del giorno. */
    public record Quest(int index, UUID npcId, String npcName, UUID roomId, String source, String minRarity,
                        int gold, String furni) {
    }

    private final JdbcTemplate jdbc;
    private final RoomRepository roomRepository;
    private final UserCardRepository userCardRepository;
    private final CardRepository cardRepository;
    private final UserCardService userCardService;
    private final WalletService walletService;
    private final FurniService furniService;

    public NpcQuestService(JdbcTemplate jdbc, RoomRepository roomRepository, UserCardRepository userCardRepository,
                           CardRepository cardRepository, UserCardService userCardService, WalletService walletService,
                           FurniService furniService) {
        this.jdbc = jdbc;
        this.roomRepository = roomRepository;
        this.userCardRepository = userCardRepository;
        this.cardRepository = cardRepository;
        this.userCardService = userCardService;
        this.walletService = walletService;
        this.furniService = furniService;
    }

    /** Gli incarichi di un giorno: scelti a caso ma uguali per tutti (il seme e' la data). */
    static List<Quest> questsOf(LocalDate day) {
        Random random = new Random(day.toEpochDay() * 7_919L + 13);
        List<Map.Entry<UUID, NpcRoster.NpcSpec>> npcs = new ArrayList<>();
        NpcRoster.rooms().stream().sorted().forEach(roomId ->
                NpcRoster.forRoom(roomId).forEach(spec -> npcs.add(Map.entry(roomId, spec))));
        npcs.sort(Comparator.comparing(e -> e.getValue().key()));
        List<Quest> quests = new ArrayList<>();
        Set<String> usedNpc = new HashSet<>();
        Set<String> usedSource = new HashSet<>();
        List<String> rarities = List.of("uncommon", "rare", "epic");
        for (int i = 0; i < QUESTS_PER_DAY && !npcs.isEmpty(); i++) {
            Map.Entry<UUID, NpcRoster.NpcSpec> npc;
            do {
                npc = npcs.get(random.nextInt(npcs.size()));
            } while (usedNpc.contains(npc.getValue().name()) && usedNpc.size() < npcs.size());
            usedNpc.add(npc.getValue().name());
            String source;
            do {
                source = SOURCES.get(random.nextInt(SOURCES.size()));
            } while (usedSource.contains(source));
            usedSource.add(source);
            String rarity = rarities.get(i);
            quests.add(new Quest(i, npc.getValue().id(npc.getKey()), npc.getValue().name(), npc.getKey(), source, rarity,
                    REWARDS.get(rarity), "epic".equals(rarity) ? RARE_FURNI : null));
        }
        return quests;
    }

    static boolean fits(Quest quest, Card card) {
        return quest.source().equals(card.getSource() == null ? "original" : card.getSource())
                && RARITY_ORDER.indexOf(card.getRarity()) >= RARITY_ORDER.indexOf(quest.minRarity());
    }

    private static LocalDate today() {
        return LocalDate.now(ZONE);
    }

    /** Incarichi di oggi con lo stato del giocatore e le sue carte che vanno bene. */
    @Transactional(readOnly = true)
    public Map<String, Object> quests(UUID userId) {
        LocalDate day = today();
        Set<Integer> done = new HashSet<>(jdbc.queryForList(
                "SELECT quest FROM hotel_quest_done WHERE user_id = ? AND day = ?", Integer.class, userId, java.sql.Date.valueOf(day)));
        List<UserCard> owned = userCardRepository.findByUserIdWithCard(userId).stream().filter(uc -> uc.getQuantity() > 0).toList();
        List<Map<String, Object>> list = new ArrayList<>();
        for (Quest quest : questsOf(day)) {
            Map<String, Object> view = new LinkedHashMap<>();
            view.put("index", quest.index());
            view.put("npcId", quest.npcId());
            view.put("npcName", quest.npcName());
            view.put("roomId", quest.roomId());
            view.put("roomName", roomRepository.findById(quest.roomId()).map(r -> r.getName()).orElse("l'hotel"));
            view.put("source", quest.source());
            view.put("minRarity", quest.minRarity());
            String game = SOURCE_NAMES.get(quest.source());
            view.put("text", "Portami una carta " + RARITY_NAMES.get(quest.minRarity()) + " (o migliore) di "
                    + game + (game.endsWith("!") ? "" : "!"));
            view.put("gold", quest.gold());
            view.put("furni", quest.furni());
            view.put("done", done.contains(quest.index()));
            // Tutte le carte che vanno bene, con quante copie se ne hanno: prima i doppioni (darli non
            // toglie niente alla collezione), poi dalla rarita' piu' bassa.
            List<UserCard> fitting = owned.stream().filter(uc -> fits(quest, uc.getCard()))
                    .sorted(Comparator.comparingInt((UserCard uc) -> uc.getQuantity() > 1 ? 0 : 1)
                            .thenComparingInt(uc -> RARITY_ORDER.indexOf(uc.getCard().getRarity()))
                            .thenComparing(uc -> uc.getCard().getName()))
                    .toList();
            view.put("requirement", "Vale qualunque carta di " + SOURCE_NAMES.get(quest.source()) + " di rarità "
                    + RARITY_NAMES.get(quest.minRarity()) + " o superiore, da qualsiasi set.");
            view.put("fitting", fitting.size());
            view.put("spares", fitting.stream().filter(uc -> uc.getQuantity() > 1).count());
            view.put("candidates", fitting.stream().limit(200).map(uc -> {
                Map<String, Object> candidate = new LinkedHashMap<>();
                candidate.put("card", CardDto.from(uc.getCard()));
                candidate.put("quantity", uc.getQuantity());
                return candidate;
            }).toList());
            list.add(view);
        }
        return Map.of("day", day.toString(), "quests", list);
    }

    /** Consegna una carta per un incarico: la carta va all'NPC, i premi al giocatore. */
    @Transactional
    public Map<String, Object> deliver(UUID userId, int index, String cardCode) {
        LocalDate day = today();
        Quest quest = questsOf(day).stream().filter(q -> q.index() == index).findFirst()
                .orElseThrow(() -> ApiException.notFound("quest_not_found"));
        Card card = cardRepository.findByCode(cardCode).orElseThrow(() -> ApiException.notFound("card_not_found"));
        if (!fits(quest, card)) throw ApiException.badRequest("quest_wrong_card");
        int inserted = jdbc.update("INSERT INTO hotel_quest_done (user_id, day, quest, card_id) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
                userId, java.sql.Date.valueOf(day), index, card.getId());
        if (inserted == 0) throw ApiException.badRequest("quest_already_done");
        User user = userCardRepository.findByUserIdAndCardId(userId, card.getId())
                .filter(uc -> uc.getQuantity() > 0).map(UserCard::getUser)
                .orElseThrow(() -> ApiException.badRequest("card_not_owned"));
        userCardService.remove(user, card, 1);
        User paid = walletService.adjustGold(userId, quest.gold(), WalletTransactionType.MINIGAME_REWARD, "quest",
                "Incarico di " + quest.npcName() + ": " + card.getName());
        if (quest.furni() != null) furniService.grant(userId, quest.furni());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("gold", paid.getGold());
        result.put("earned", quest.gold());
        result.put("furni", quest.furni());
        result.put("npcName", quest.npcName());
        return result;
    }
}
