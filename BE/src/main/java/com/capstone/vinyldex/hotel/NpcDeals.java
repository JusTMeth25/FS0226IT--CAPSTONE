package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.NpcFoundCard;
import com.capstone.vinyldex.entity.NpcTrade;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.UserCard;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.NpcFoundCardRepository;
import com.capstone.vinyldex.repository.NpcTradeRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.repository.UserWalletTransactionRepository;
import com.capstone.vinyldex.service.LevelService;
import com.capstone.vinyldex.service.UserCardService;
import com.capstone.vinyldex.service.WalletService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Carte e premi degli NPC: con chi scambiano, cosa offrono, con che squadra giocano.
 *
 * Gli NPC non hanno una collezione nel database: ogni giorno ognuno "tiene in tasca" qualche
 * carta scelta dal catalogo, sempre la stessa per tutta la giornata. Gli scambi spostano carte
 * vere nella collezione del giocatore, quindi devono essere equi: il valore di una carta viene
 * dalla rarita' e dal prezzo di mercato, e l'NPC accetta solo se non ci rimette.
 */
@Service
public class NpcDeals {

    /** Valore di base per rarita': una leggendaria vale molto piu' di dieci comuni. */
    private static final Map<String, Integer> RARITY_VALUE = Map.of(
            "common", 10, "uncommon", 25, "rare", 60, "epic", 150, "legendary", 400);

    /** Scambi con gli NPC al giorno per giocatore: bastano a divertirsi, non a fare incetta. */
    public static final int TRADES_PER_DAY = 5;
    /** Partite contro gli NPC premiate al giorno, con premi piu' bassi di quelle fra giocatori. */
    public static final int REWARDED_MATCHES_PER_DAY = 5;
    static final PvpRewardService.Reward WIN = new PvpRewardService.Reward(50, 100);
    static final PvpRewardService.Reward DRAW = new PvpRewardService.Reward(20, 40);
    static final PvpRewardService.Reward LOSS = new PvpRewardService.Reward(5, 10);
    /** L'NPC accetta se riceve almeno il 90% del valore che da'. */
    static final double FAIRNESS = 0.9;

    public record Offer(Card give, Card want) {
    }

    public enum Verdict { ACCEPTED, UNFAIR, NOT_OWNED, NOT_OFFERED, LIMIT }

    private final CardRepository cardRepository;
    private final UserCardRepository userCardRepository;
    private final UserRepository userRepository;
    private final UserCardService userCardService;
    private final WalletService walletService;
    private final LevelService levelService;
    private final UserWalletTransactionRepository transactionRepository;
    private final NpcTradeRepository npcTradeRepository;
    private final NpcFoundCardRepository foundRepository;
    private final Clock clock = Clock.systemDefaultZone();

    private List<Card> pool = List.of();
    /**
     * Carte trovate dagli NPC nei pacchetti aperti nell'hotel (hotel_npc_found_cards): finiscono
     * nella loro vetrina degli scambi, le piu' recenti prima, e restano anche dopo un riavvio.
     * Ogni NPC ne tiene al massimo FOUND_KEPT; quando ne scambia una, esce dalla vetrina.
     */
    static final int FOUND_KEPT = 4;
    private long poolLoadedAt;

    public NpcDeals(CardRepository cardRepository, UserCardRepository userCardRepository, UserRepository userRepository,
                    UserCardService userCardService, WalletService walletService, LevelService levelService,
                    UserWalletTransactionRepository transactionRepository, NpcTradeRepository npcTradeRepository,
                    NpcFoundCardRepository foundRepository) {
        this.cardRepository = cardRepository;
        this.userCardRepository = userCardRepository;
        this.userRepository = userRepository;
        this.userCardService = userCardService;
        this.walletService = walletService;
        this.levelService = levelService;
        this.transactionRepository = transactionRepository;
        this.npcTradeRepository = npcTradeRepository;
        this.foundRepository = foundRepository;
    }

    // ------------------------------------------------------------------ valore delle carte

    public static int value(Card card) {
        int base = RARITY_VALUE.getOrDefault(card.getRarity(), 10);
        Double price = card.getMarketPrice();
        return base + (price == null || price <= 0 ? 0 : (int) Math.round(Math.min(price, 200) * 2));
    }

    /** Le carte del catalogo, ricaricate ogni dieci minuti. */
    private synchronized List<Card> pool() {
        long now = System.currentTimeMillis();
        if (pool.isEmpty() || now - poolLoadedAt > 10 * 60_000) {
            pool = cardRepository.findAllActiveWithArtistClass();
            poolLoadedAt = now;
        }
        return pool;
    }

    private List<Card> ofRarity(String rarity) {
        return pool().stream().filter(c -> !c.isUltimate() && rarity.equals(c.getRarity())).toList();
    }

    // ------------------------------------------------------------------ vetrina e proposte

    /**
     * Le carte che l'NPC offre oggi: sempre le stesse per tutta la giornata. Qualche comune,
     * una rara e, con un po' di fortuna, un'epica o una leggendaria.
     */
    @Transactional(readOnly = true)
    public List<Card> showcase(UUID npcId) {
        Random random = new Random(npcId.hashCode() * 31L + LocalDate.now(clock).toEpochDay());
        List<String> wanted = new ArrayList<>(List.of("common", "uncommon", "uncommon", "rare"));
        wanted.add(random.nextInt(5) == 0 ? "legendary" : "epic");
        // Prima le carte appena trovate nei pacchetti, poi quelle del giorno.
        List<Card> cards = new ArrayList<>(found(npcId));
        for (String rarity : wanted) {
            List<Card> options = ofRarity(rarity);
            if (options.isEmpty()) continue;
            Card card = options.get(random.nextInt(options.size()));
            if (cards.stream().noneMatch(c -> c.getId().equals(card.getId()))) cards.add(card);
        }
        return cards;
    }

    /**
     * L'NPC ha aperto un pacchetto: le carte migliori (fino a FOUND_KEPT, le piu' preziose) entrano
     * nella sua vetrina degli scambi al posto delle meno recenti.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void addFound(UUID npcId, List<Card> cards) {
        // Le due piu' preziose, con la migliore un attimo piu' recente: cosi' resta in cima.
        List<Card> best = cards.stream().sorted(Comparator.comparingInt(NpcDeals::value).reversed()).limit(2).toList();
        Instant now = Instant.now();
        for (int i = best.size() - 1; i >= 0; i--) {
            Card card = best.get(i);
            Instant at = now.plusMillis(best.size() - 1L - i);
            NpcFoundCard row = foundRepository.findByNpcIdAndCardId(npcId, card.getId())
                    .orElseGet(() -> new NpcFoundCard(npcId, card.getId(), at));
            row.setFoundAt(at);
            foundRepository.save(row);
        }
        List<NpcFoundCard> kept = foundRepository.findByNpcIdOrderByFoundAtDesc(npcId);
        if (kept.size() > FOUND_KEPT) foundRepository.deleteAll(kept.subList(FOUND_KEPT, kept.size()));
    }

    /** Carte trovate ancora nella vetrina dell'NPC, dalla piu' recente (le carte disattivate no). */
    @Transactional(readOnly = true)
    public List<Card> found(UUID npcId) {
        Map<UUID, Card> active = pool().stream().collect(Collectors.toMap(Card::getId, c -> c, (a, b) -> a));
        return foundRepository.findByNpcIdOrderByFoundAtDesc(npcId).stream()
                .limit(FOUND_KEPT)
                .map(row -> active.get(row.getCardId()))
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    /**
     * Proposta dell'NPC: chiede una carta doppia del giocatore (o una qualsiasi, se non ha
     * doppie) e in cambio offre una carta che il giocatore non ha ancora, di valore simile o un
     * po' piu' alto: deve essere invitante.
     */
    @Transactional(readOnly = true)
    public Optional<Offer> makeOffer(UUID userId, Random random) {
        List<UserCard> owned = userCardRepository.findByUserIdWithCard(userId).stream()
                .filter(uc -> uc.getQuantity() > 0).toList();
        if (owned.isEmpty()) return Optional.empty();
        List<UserCard> doubles = owned.stream().filter(uc -> uc.getQuantity() > 1).toList();
        List<UserCard> candidates = doubles.isEmpty() ? owned : doubles;
        Card want = candidates.get(random.nextInt(candidates.size())).getCard();

        Set<UUID> ownedIds = owned.stream().map(uc -> uc.getCard().getId()).collect(Collectors.toSet());
        int target = value(want);
        List<Card> fair = pool().stream()
                .filter(c -> !c.isUltimate() && !ownedIds.contains(c.getId()))
                .filter(c -> value(c) >= target && value(c) <= target * 1.3 + 5)
                .toList();
        if (fair.isEmpty()) {
            // Nessuna carta di valore simile: si prende quella nuova piu' vicina per valore.
            fair = pool().stream().filter(c -> !c.isUltimate() && !ownedIds.contains(c.getId()) && value(c) >= target)
                    .sorted(Comparator.comparingInt(NpcDeals::value)).limit(5).toList();
        }
        if (fair.isEmpty()) return Optional.empty();
        return Optional.of(new Offer(fair.get(random.nextInt(fair.size())), want));
    }

    /**
     * Esegue uno scambio accettato: il giocatore da' una copia di `giveCode` e riceve una copia
     * di `getCode`. Tutto in una transazione, dopo aver controllato che la carta sia ancora sua.
     * Lo scambio resta nello storico, da cui si conta il limite giornaliero.
     */
    @Transactional
    public Verdict trade(UUID userId, String npcName, String giveCode, String getCode) {
        if (tradesToday(userId) >= TRADES_PER_DAY) return Verdict.LIMIT;
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("user_not_found"));
        Card give = cardRepository.findByCode(giveCode).orElse(null);
        Card get = cardRepository.findByCode(getCode).orElse(null);
        if (give == null || get == null || !userCardService.owns(user, give, 1)) return Verdict.NOT_OWNED;
        userCardService.remove(user, give, 1);
        userCardService.add(user, get, 1);
        NpcTrade record = new NpcTrade();
        record.setUserId(userId);
        record.setNpcName(npcName);
        record.setGaveCardId(give.getId());
        record.setGotCardId(get.getId());
        record.setDay(LocalDate.now(clock));
        npcTradeRepository.save(record);
        return Verdict.ACCEPTED;
    }

    /** Proposta del giocatore: una carta della vetrina dell'NPC in cambio di una sua. */
    @Transactional
    public Verdict propose(UUID npcId, String npcName, UUID userId, String giveCode, String wantCode) {
        Card want = showcase(npcId).stream().filter(c -> c.getCode().equals(wantCode)).findFirst().orElse(null);
        if (want == null) return Verdict.NOT_OFFERED;
        Card give = cardRepository.findByCode(giveCode).orElse(null);
        if (give == null) return Verdict.NOT_OWNED;
        // Una copia gradata dal perito vale di piu' anche per gli NPC.
        double giveValue = value(give) * userCardRepository.findByUserIdAndCardId(userId, give.getId())
                .map(uc -> com.capstone.vinyldex.service.GradingService.multiplier(uc.getGrade())).orElse(1.0);
        if (giveValue < value(want) * FAIRNESS) return Verdict.UNFAIR;
        Verdict verdict = trade(userId, npcName, giveCode, wantCode);
        // Una carta trovata e poi scambiata non e' piu' dell'NPC.
        if (verdict == Verdict.ACCEPTED) foundRepository.findByNpcIdAndCardId(npcId, want.getId()).ifPresent(foundRepository::delete);
        return verdict;
    }

    @Transactional(readOnly = true)
    public int tradesToday(UUID userId) {
        return (int) npcTradeRepository.countByUserIdAndDay(userId, LocalDate.now(clock));
    }

    // ------------------------------------------------------------------ sfide

    /**
     * Squadra di tre carte per un NPC. Gli sfidanti sono forti (rare ed epiche), gli altri
     * giocano con carte piu' comuni. Si pesca dal catalogo a ogni partita.
     */
    @Transactional(readOnly = true)
    public List<PvpGame.CardInfo> team(NpcRoster.Role role, Random random) {
        List<String> rarities = role == NpcRoster.Role.FIGHTER
                ? List.of("rare", random.nextBoolean() ? "rare" : "epic", random.nextInt(4) == 0 ? "legendary" : "epic")
                : List.of("common", "uncommon", "rare");
        List<PvpGame.CardInfo> team = new ArrayList<>();
        for (String rarity : rarities) {
            List<Card> options = ofRarity(rarity);
            if (options.isEmpty()) options = pool().stream().filter(c -> !c.isUltimate()).toList();
            Card card = options.get(random.nextInt(options.size()));
            team.add(PvpService.cardInfo(card));
        }
        return team;
    }

    /**
     * Premio al giocatore per una partita contro un NPC. Le partite non finiscono in pvp_matches
     * (che vuole due giocatori veri): il limite giornaliero si conta dalle transazioni del
     * portafoglio con riferimento "npc:".
     */
    @Transactional
    public PvpRewardService.PlayerReward reward(UUID userId, String npcName, boolean won, boolean draw) {
        User user = userRepository.findById(userId).orElseThrow();
        Instant startOfDay = LocalDate.now(clock).atStartOfDay(clock.getZone()).toInstant();
        long rewarded = transactionRepository.countByUserIdAndTypeAndRelatedIdStartingWithAndCreatedAtAfter(
                userId, WalletTransactionType.PVP_REWARD, "npc:", startOfDay);
        if (rewarded >= REWARDED_MATCHES_PER_DAY) return new PvpRewardService.PlayerReward(0, 0, true, user.getLevel());

        PvpRewardService.Reward reward = draw ? DRAW : won ? WIN : LOSS;
        user = walletService.adjustGold(userId, reward.gold(), WalletTransactionType.PVP_REWARD, "npc:" + npcName,
                "Sfida contro " + npcName);
        user.setXp(user.getXp() + reward.xp());
        user.setLevel(levelService.calcLevel(user.getXp()));
        if (won) user.setBattlesWon(user.getBattlesWon() + 1);
        userRepository.save(user);
        return new PvpRewardService.PlayerReward(reward.gold(), reward.xp(), false, user.getLevel());
    }
}
