package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import com.capstone.vinyldex.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;

/**
 * NPC giocatori: alcuni personaggi dell'hotel hanno un account senza accesso e partecipano come
 * i giocatori veri, cosi' asta, eventi a orario, tornei, mostra e stagione non restano vuoti.
 *
 * Giocano "come persone": punteggi da giocatore medio (i bravi li battono), non tutti a ogni
 * evento, si iscrivono ai tornei solo se mancano giocatori. L'asta la gestisce AuctionService.
 */
@Service
public class NpcPlayers {

    private static final Logger LOG = LoggerFactory.getLogger(NpcPlayers.class);
    /** I personaggi che giocano: ospiti e sportivi sparsi per l'hotel (chiavi di NpcRoster). */
    static final List<String> KEYS = List.of("greta", "dario", "kira", "brutus", "otto", "stella", "nando", "strike");
    static final String SUFFIX = " (NPC)";
    static final int START_GOLD = 20_000;
    static final int START_CARDS = 14;

    /** Un NPC giocatore: il suo account e il personaggio nell'hotel. */
    public record Bot(UUID userId, String username, UUID npcId, String name) {
    }

    private final UserRepository userRepository;
    private final UserCardRepository userCardRepository;
    private final CardRepository cardRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbc;
    private final ApplicationEventPublisher publisher;
    private final TransactionTemplate tx;
    private final Random random = new Random();
    private volatile List<Bot> bots = List.of();

    private TournamentService tournamentService;
    private GalleryService galleryService;
    private HotelEventService eventService;

    public NpcPlayers(UserRepository userRepository, UserCardRepository userCardRepository, CardRepository cardRepository,
                      PasswordEncoder passwordEncoder, JdbcTemplate jdbc, ApplicationEventPublisher publisher,
                      PlatformTransactionManager transactionManager) {
        this.userRepository = userRepository;
        this.userCardRepository = userCardRepository;
        this.cardRepository = cardRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbc = jdbc;
        this.publisher = publisher;
        this.tx = new TransactionTemplate(transactionManager);
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setServices(@org.springframework.context.annotation.Lazy TournamentService tournamentService,
                     @org.springframework.context.annotation.Lazy GalleryService galleryService,
                     @org.springframework.context.annotation.Lazy HotelEventService eventService) {
        this.tournamentService = tournamentService;
        this.galleryService = galleryService;
        this.eventService = eventService;
    }

    public List<Bot> bots() {
        return bots;
    }

    public boolean isBot(UUID userId) {
        return userId != null && bots.stream().anyMatch(b -> b.userId().equals(userId));
    }

    public Optional<Bot> bot(UUID userId) {
        return bots.stream().filter(b -> b.userId().equals(userId)).findFirst();
    }

    public Bot randomBot() {
        List<Bot> list = bots;
        return list.isEmpty() ? null : list.get(random.nextInt(list.size()));
    }

    // ------------------------------------------------------------------ account

    /** All'avvio: crea gli account che mancano, con un po' di gold e qualche carta da esporre. */
    @EventListener(ApplicationReadyEvent.class)
    public void init() {
        try {
            tx.executeWithoutResult(status -> ensureBots());
            LOG.info("NPC giocatori pronti: {}", bots.stream().map(Bot::username).toList());
        } catch (RuntimeException ex) {
            LOG.warn("NPC giocatori non creati: {}", ex.getMessage());
        }
    }

    void ensureBots() {
        List<Bot> list = new ArrayList<>();
        List<Card> pool = cardRepository.findAllActiveWithArtistClass().stream()
                .filter(c -> !c.isUltimate() && List.of("rare", "epic", "legendary").contains(c.getRarity()) && c.getImgUrl() != null)
                .toList();
        for (String key : KEYS) {
            Optional<NpcRoster.Located> located = NpcRoster.byKey(key);
            if (located.isEmpty()) continue;
            NpcRoster.NpcSpec spec = located.get().spec();
            String username = spec.name() + SUFFIX;
            User user = userRepository.findByUsername(username).orElseGet(() -> {
                User created = new User();
                created.setUsername(username);
                created.setEmail("npc-" + key + "@hotel.vinyldex.local");
                // Password casuale mai comunicata: l'account non si puo' usare per entrare.
                created.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
                created.setGold(START_GOLD);
                created.setHotelLook(spec.look());
                created.setHotelTutorialDone(true);
                created.setNpc(true);
                return userRepository.save(created);
            });
            if (!user.isNpc()) continue; // un giocatore vero con quel nome: lo si lascia stare
            long owned = userCardRepository.findByUserId(user.getId()).stream().filter(uc -> uc.getQuantity() > 0).count();
            if (owned < 5 && !pool.isEmpty()) {
                List<Card> shuffled = new ArrayList<>(pool);
                Collections.shuffle(shuffled, random);
                shuffled.stream().limit(START_CARDS).forEach(card -> jdbc.update(
                        "INSERT INTO user_cards (id, user_id, card_id, quantity, obtained_at) VALUES (gen_random_uuid(), ?, ?, 1, now()) "
                                + "ON CONFLICT (user_id, card_id) DO NOTHING", user.getId(), card.getId()));
            }
            list.add(new Bot(user.getId(), username, spec.id(located.get().roomId()), spec.name()));
        }
        bots = List.copyOf(list);
    }

    // ------------------------------------------------------------------ partite

    /** Punteggio da giocatore medio: fra il 30% e il 75% del massimo del minigioco. */
    int scoreFor(String game) {
        int max = Minigames.maxScore(game);
        if (max <= 0) return 0;
        int low = Math.max(1, (int) Math.round(max * 0.3));
        int high = Math.max(low, (int) Math.round(max * 0.75));
        return low + random.nextInt(high - low + 1);
    }

    /** L'NPC fa una partita: la registrano eventi, tornei e stagione come per chiunque altro. */
    void play(Bot bot, String game) {
        if (HotelEventService.GOALS.equals(game)) {
            publisher.publishEvent(new HotelGameEvents.GoalScored(null, bot.userId(), bot.username(), random.nextBoolean() ? "blue" : "red"));
            return;
        }
        int score = scoreFor(game);
        if (score > 0) publisher.publishEvent(new HotelGameEvents.MinigamePlayed(null, bot.userId(), bot.username(), game, score));
    }

    @Scheduled(fixedDelay = 45_000, initialDelay = 60_000)
    public void tick() {
        if (bots.isEmpty()) return;
        try {
            playEvents();
            tx.executeWithoutResult(status -> playTournament());
            tx.executeWithoutResult(status -> exhibitAndVote());
        } catch (RuntimeException ex) {
            LOG.warn("NPC giocatori: {}", ex.getMessage());
        }
    }

    /** Eventi in corso: ogni tanto qualche NPC gioca e sale in classifica. */
    void playEvents() {
        // Anche gli eventi creati dall'admin (definitions() li comprende).
        List<HotelEventService.Edition> live = eventService == null ? HotelEventService.active(Instant.now())
                : HotelEventService.active(Instant.now(), eventService.definitions());
        for (HotelEventService.Edition edition : live) {
            for (Bot bot : bots) {
                // Circa due NPC per giro: l'evento si riempie senza che gli NPC lo dominino.
                if (random.nextInt(bots.size()) < 2) play(bot, edition.def().game());
            }
        }
    }

    /**
     * Tornei: se a meta' iscrizioni mancano giocatori, gli NPC riempiono i posti fino al minimo;
     * durante il torneo giocano la loro partita un po' dopo l'inizio del turno.
     */
    void playTournament() {
        if (tournamentService == null) return;
        Map<String, Object> t = jdbc.queryForList("SELECT * FROM tournaments WHERE status IN ('SIGNUP', 'RUNNING') ORDER BY created_at DESC LIMIT 1")
                .stream().findFirst().orElse(null);
        if (t == null) return;
        UUID id = (UUID) t.get("id");
        String game = (String) t.get("game");
        if ("SIGNUP".equals(t.get("status"))) {
            Instant ends = ((Timestamp) t.get("signup_ends")).toInstant();
            if (ends.minusSeconds(8 * 60).isAfter(Instant.now())) return;
            List<UUID> joined = jdbc.queryForList("SELECT user_id FROM tournament_players WHERE tournament_id = ?", UUID.class, id);
            int missing = TournamentService.MIN_PLAYERS - joined.size();
            List<Bot> free = new ArrayList<>(bots.stream().filter(b -> !joined.contains(b.userId())).toList());
            Collections.shuffle(free, random);
            for (int i = 0; i < missing && i < free.size(); i++) tournamentService.signup(free.get(i).userId());
            return;
        }
        List<Map<String, Object>> matches = jdbc.queryForList("SELECT * FROM tournament_matches WHERE tournament_id = ? AND round = ? "
                + "AND winner_id IS NULL", id, t.get("round"));
        for (Map<String, Object> m : matches) {
            Instant deadline = ((Timestamp) m.get("deadline")).toInstant();
            // Si gioca a turno gia' avviato da qualche minuto (e prima della scadenza).
            if (deadline.minusSeconds(10 * 60).isAfter(Instant.now())) continue;
            for (String side : List.of("a", "b")) {
                UUID player = (UUID) m.get(side + "_id");
                if (m.get(side + "_score") == null) bot(player).ifPresent(bot -> play(bot, game));
            }
        }
    }

    /** Mostra della settimana: ogni NPC espone le sue carte migliori e vota una mostra. */
    void exhibitAndVote() {
        if (galleryService == null) return;
        java.sql.Date week = java.sql.Date.valueOf(GalleryService.thisWeek());
        for (Bot bot : bots) {
            Integer exhibited = jdbc.queryForObject("SELECT count(*) FROM gallery_entries WHERE user_id = ? AND week = ?",
                    Integer.class, bot.userId(), week);
            if (exhibited != null && exhibited == 0) {
                List<String> best = userCardRepository.findByUserIdWithCard(bot.userId()).stream()
                        .filter(uc -> uc.getQuantity() > 0)
                        .sorted((a, b) -> Integer.compare(NpcDeals.value(b.getCard()), NpcDeals.value(a.getCard())))
                        .limit(GalleryService.MAX_CARDS).map(uc -> uc.getCard().getCode()).toList();
                if (!best.isEmpty()) galleryService.exhibit(bot.userId(), best);
            }
            Integer voted = jdbc.queryForObject("SELECT count(*) FROM gallery_votes WHERE voter_id = ? AND week = ?",
                    Integer.class, bot.userId(), week);
            if (voted != null && voted == 0) {
                List<UUID> entries = jdbc.queryForList("SELECT user_id FROM gallery_entries WHERE week = ? AND user_id <> ?",
                        UUID.class, week, bot.userId());
                if (!entries.isEmpty()) galleryService.vote(bot.userId(), entries.get(random.nextInt(entries.size())));
            }
        }
    }
}
