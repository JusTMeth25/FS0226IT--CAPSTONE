package com.capstone.vinyldex.casino;

import com.capstone.vinyldex.casino.CasinoGames.Card;
import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.hotel.HotelSession;
import com.capstone.vinyldex.hotel.RoomInstance;
import com.capstone.vinyldex.hotel.RoomRegistry;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.service.WalletService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.random.RandomGenerator;

/**
 * Il casino dell'hotel: fiches, cassa e tavoli. Si punta in fiches (comprate alla cassa, 1 gold =
 * 1 fiche, piu' un regalo di benvenuto al giorno) o direttamente in gold.
 *
 * Tutto lo decide il server: carte, rulli, numeri e dadi escono da un generatore sicuro, e ogni
 * puntata si scala dal saldo prima di giocare e si paga a fine giro nella stessa transazione. Il
 * browser mostra solo le animazioni. Si gioca solo stando nella stanza del casino.
 */
@Service
public class CasinoService {

    /** La stanza pubblica del casino (migrazione V66). */
    public static final UUID CASINO_ROOM = UUID.fromString("00000000-0000-0000-0000-00000000a020");
    public static final int MIN_BET = 1;
    public static final int MAX_BET = 1_000;
    /** Puntate sullo stesso giro di roulette o di baccarat, tutte insieme. */
    public static final int MAX_TABLE_BET = 2_000;
    /** Regalo di benvenuto: fiches gratis una volta al giorno. */
    public static final int DAILY_CHIPS = 200;
    /** Vincite da annunciare a tutta la sala: almeno 10 volte la puntata e 100 fra fiches o gold. */
    private static final int BIG_WIN = 100;

    public enum Currency { CHIPS, GOLD }

    private final UserRepository userRepository;
    private final WalletService walletService;
    private final RoomRegistry registry;
    private final RandomGenerator random;
    private final boolean checkRoom;

    /** Mani di blackjack e video poker in corso (la puntata e' gia' stata scalata). */
    private final Map<UUID, Blackjack> blackjack = new ConcurrentHashMap<>();
    private final Map<UUID, Poker> poker = new ConcurrentHashMap<>();

    private static final class Blackjack {
        final List<Card> shoe;
        final List<Card> player = new ArrayList<>();
        final List<Card> dealer = new ArrayList<>();
        int stake;
        final Currency currency;
        boolean doubled;

        Blackjack(List<Card> shoe, int stake, Currency currency) {
            this.shoe = shoe;
            this.stake = stake;
            this.currency = currency;
        }
    }

    private static final class Poker {
        final List<Card> deck;
        final List<Card> hand = new ArrayList<>();
        final int stake;
        final Currency currency;

        Poker(List<Card> deck, int stake, Currency currency) {
            this.deck = deck;
            this.stake = stake;
            this.currency = currency;
        }
    }

    @org.springframework.beans.factory.annotation.Autowired
    public CasinoService(UserRepository userRepository, WalletService walletService, RoomRegistry registry) {
        this(userRepository, walletService, registry, new SecureRandom(), true);
    }

    /** Per i test: generatore prevedibile e niente controllo della stanza. */
    CasinoService(UserRepository userRepository, WalletService walletService, RoomRegistry registry,
                  RandomGenerator random, boolean checkRoom) {
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.registry = registry;
        this.random = random;
        this.checkRoom = checkRoom;
    }

    // ------------------------------------------------------------------ saldi e cassa

    public Map<String, Object> wallet(UUID userId) {
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("user_not_found"));
        Map<String, Object> view = balances(user);
        view.put("bonusReady", !LocalDate.now().equals(user.getCasinoBonusDay()));
        view.put("dailyChips", DAILY_CHIPS);
        view.put("minBet", MIN_BET);
        view.put("maxBet", MAX_BET);
        view.put("blackjack", blackjack.containsKey(userId) ? blackjackView(blackjack.get(userId), false) : null);
        view.put("poker", poker.containsKey(userId) ? pokerView(poker.get(userId), null, 0) : null);
        return view;
    }

    private static Map<String, Object> balances(User user) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("gold", user.getGold());
        view.put("chips", user.getCasinoChips());
        return view;
    }

    /** Cassa: gold in fiches ("buy") o fiches in gold ("sell"), 1 a 1. */
    @Transactional
    public Map<String, Object> exchange(UUID userId, String action, int amount) {
        if (amount < 1 || amount > 100_000) throw ApiException.badRequest("casino_bad_amount");
        if ("buy".equals(action)) {
            walletService.adjustGold(userId, -amount, WalletTransactionType.CASINO, "casino:cashier", "Fiches comprate alla cassa: " + amount);
            moveChips(userId, amount);
        } else if ("sell".equals(action)) {
            moveChips(userId, -amount);
            walletService.adjustGold(userId, amount, WalletTransactionType.CASINO, "casino:cashier", "Fiches cambiate alla cassa: " + amount);
        } else {
            throw ApiException.badRequest("casino_bad_action");
        }
        return balances(userRepository.findById(userId).orElseThrow());
    }

    /** Regalo di benvenuto: DAILY_CHIPS fiches una volta al giorno. */
    @Transactional
    public Map<String, Object> dailyBonus(UUID userId) {
        User user = userRepository.findByIdForUpdate(userId).orElseThrow(() -> ApiException.notFound("user_not_found"));
        if (LocalDate.now().equals(user.getCasinoBonusDay())) throw ApiException.conflict("casino_bonus_taken");
        user.setCasinoBonusDay(LocalDate.now());
        user.setCasinoChips(user.getCasinoChips() + DAILY_CHIPS);
        userRepository.save(user);
        Map<String, Object> view = balances(user);
        view.put("bonus", DAILY_CHIPS);
        return view;
    }

    /** Cassa del banco: facoltativa, cosi' i test che costruiscono il servizio a mano non cambiano. */
    private CasinoBank bank;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setBank(CasinoBank bank) {
        this.bank = bank;
    }

    /** Il banco incassa quello che il giocatore perde e paga quello che vince. */
    private void toBank(Currency currency, int playerDelta) {
        if (bank != null) bank.record(currency, -(long) playerDelta);
    }

    /**
     * Fiches portate a un tavolo (poker, cartelle del bingo, puntate ai cavalli: delta negativo) o
     * riportate indietro (vincite, rimborsi, uscita dal tavolo: positivo). Passano dalla cassa del banco.
     */
    @Transactional
    public void tableChips(UUID userId, int delta) {
        moveChips(userId, delta);
        toBank(Currency.CHIPS, delta);
    }

    private void moveChips(UUID userId, int delta) {
        User user = userRepository.findByIdForUpdate(userId).orElseThrow(() -> ApiException.notFound("user_not_found"));
        int next = user.getCasinoChips() + delta;
        if (next < 0) throw ApiException.conflict("casino_not_enough_chips");
        user.setCasinoChips(next);
        userRepository.save(user);
    }

    private void pay(UUID userId, Currency currency, int delta, String game) {
        if (delta == 0) return;
        toBank(currency, delta);
        if (currency == Currency.GOLD) {
            walletService.adjustGold(userId, delta, WalletTransactionType.CASINO, "casino:" + game,
                    (delta < 0 ? "Puntata al casino: " : "Vincita al casino: ") + game);
        } else {
            moveChips(userId, delta);
        }
    }

    private Currency currency(String value) {
        return "gold".equalsIgnoreCase(value) ? Currency.GOLD : Currency.CHIPS;
    }

    private static void checkBet(int bet) {
        if (bet < MIN_BET || bet > MAX_BET) throw ApiException.badRequest("casino_bad_bet");
    }

    private void checkInCasino(UUID userId) {
        if (!checkRoom) return;
        HotelSession session = registry.sessionOf(userId);
        if (session == null || !CASINO_ROOM.equals(session.roomId())) throw ApiException.forbidden("casino_not_here");
    }

    /** Risultato di un giro: quanto si e' puntato, quanto torna e i saldi dopo. */
    private Map<String, Object> result(UUID userId, Currency currency, String game, int staked, int returned) {
        User user = userRepository.findById(userId).orElseThrow();
        Map<String, Object> view = balances(user);
        view.put("currency", currency.name().toLowerCase());
        view.put("staked", staked);
        view.put("returned", returned);
        view.put("net", returned - staked);
        if (returned - staked >= BIG_WIN && returned >= staked * 10) announce(user, game, returned - staked, currency);
        return view;
    }

    private void announce(User user, String game, int amount, Currency currency) {
        RoomInstance room = registry.get(CASINO_ROOM);
        if (room == null) return;
        room.announce(Map.of("type", "casino_win", "by", user.getUsername(), "game", game, "amount", amount,
                "currency", currency.name().toLowerCase()));
    }

    // ------------------------------------------------------------------ slot

    @Transactional
    public Map<String, Object> slot(UUID userId, int bet, String currencyName) {
        checkInCasino(userId);
        checkBet(bet);
        Currency currency = currency(currencyName);
        pay(userId, currency, -bet, "slot");
        CasinoGames.SlotSpin spin = CasinoGames.spinSlot(random);
        int returned = bet * spin.multiplier();
        pay(userId, currency, returned, "slot");
        Map<String, Object> view = result(userId, currency, "Slot", bet, returned);
        view.put("reels", spin.reels());
        view.put("line", spin.line());
        view.put("multiplier", spin.multiplier());
        view.put("win", spin.win());
        return view;
    }

    // ------------------------------------------------------------------ roulette

    public record RouletteBet(String bet, int stake) {
    }

    @Transactional
    public Map<String, Object> roulette(UUID userId, List<RouletteBet> bets, String currencyName) {
        checkInCasino(userId);
        if (bets == null || bets.isEmpty() || bets.size() > 40) throw ApiException.badRequest("casino_bad_bet");
        int total = 0;
        for (RouletteBet b : bets) {
            checkBet(b.stake());
            if (CasinoGames.rouletteReturn(b.bet(), b.stake(), 0) < 0) throw ApiException.badRequest("casino_bad_bet");
            total += b.stake();
        }
        if (total > MAX_TABLE_BET) throw ApiException.badRequest("casino_bad_bet");
        Currency currency = currency(currencyName);
        pay(userId, currency, -total, "roulette");
        int number = random.nextInt(37);
        int returned = 0;
        List<Map<String, Object>> results = new ArrayList<>();
        for (RouletteBet b : bets) {
            int back = CasinoGames.rouletteReturn(b.bet(), b.stake(), number);
            returned += back;
            results.add(Map.of("bet", b.bet(), "stake", b.stake(), "returned", back));
        }
        pay(userId, currency, returned, "roulette");
        Map<String, Object> view = result(userId, currency, "Roulette", total, returned);
        view.put("number", number);
        view.put("color", number == 0 ? "green" : CasinoGames.isRed(number) ? "red" : "black");
        view.put("bets", results);
        return view;
    }

    // ------------------------------------------------------------------ blackjack

    @Transactional
    public Map<String, Object> blackjackDeal(UUID userId, int bet, String currencyName) {
        checkInCasino(userId);
        Blackjack open = blackjack.get(userId);
        if (open != null) return blackjackView(open, false);
        checkBet(bet);
        Currency currency = currency(currencyName);
        pay(userId, currency, -bet, "blackjack");
        Blackjack hand = new Blackjack(CasinoGames.shoe(6, random), bet, currency);
        hand.player.add(hand.shoe.removeFirst());
        hand.dealer.add(hand.shoe.removeFirst());
        hand.player.add(hand.shoe.removeFirst());
        hand.dealer.add(hand.shoe.removeFirst());
        blackjack.put(userId, hand);
        // Blackjack servito (al giocatore o al banco): la mano finisce subito.
        if (CasinoGames.isBlackjack(hand.player) || CasinoGames.isBlackjack(hand.dealer)) return blackjackFinish(userId, hand);
        return blackjackView(hand, false);
    }

    @Transactional
    public Map<String, Object> blackjackAction(UUID userId, String action) {
        checkInCasino(userId);
        Blackjack hand = blackjack.get(userId);
        if (hand == null) throw ApiException.conflict("casino_no_hand");
        switch (action) {
            case "hit" -> {
                hand.player.add(hand.shoe.removeFirst());
                if (CasinoGames.blackjackValue(hand.player) >= 21) return blackjackFinish(userId, hand);
                return blackjackView(hand, false);
            }
            case "double" -> {
                if (hand.player.size() != 2 || hand.doubled) throw ApiException.conflict("casino_cannot_double");
                pay(userId, hand.currency, -hand.stake, "blackjack");
                hand.stake *= 2;
                hand.doubled = true;
                hand.player.add(hand.shoe.removeFirst());
                return blackjackFinish(userId, hand);
            }
            case "stand" -> {
                return blackjackFinish(userId, hand);
            }
            default -> throw ApiException.badRequest("casino_bad_action");
        }
    }

    private Map<String, Object> blackjackFinish(UUID userId, Blackjack hand) {
        blackjack.remove(userId);
        if (CasinoGames.blackjackValue(hand.player) <= 21 && !CasinoGames.isBlackjack(hand.player)) {
            CasinoGames.dealerPlays(hand.dealer, hand.shoe);
        }
        int returned = CasinoGames.blackjackReturn(hand.player, hand.dealer, hand.stake);
        pay(userId, hand.currency, returned, "blackjack");
        Map<String, Object> view = result(userId, hand.currency, "Blackjack", hand.stake, returned);
        view.putAll(blackjackView(hand, true));
        String outcome;
        if (CasinoGames.blackjackValue(hand.player) > 21) outcome = "bust";
        else if (returned > hand.stake) outcome = CasinoGames.isBlackjack(hand.player) ? "blackjack" : "win";
        else outcome = returned == hand.stake ? "push" : "lose";
        view.put("outcome", outcome);
        return view;
    }

    private static Map<String, Object> blackjackView(Blackjack hand, boolean done) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("player", CasinoGames.codes(hand.player));
        view.put("playerValue", CasinoGames.blackjackValue(hand.player));
        // Durante la mano la seconda carta del banco resta coperta.
        view.put("dealer", done ? CasinoGames.codes(hand.dealer) : List.of(hand.dealer.getFirst().code(), "??"));
        view.put("dealerValue", done ? CasinoGames.blackjackValue(hand.dealer) : CasinoGames.blackjackValue(List.of(hand.dealer.getFirst())));
        view.put("stake", hand.stake);
        view.put("currency", hand.currency.name().toLowerCase());
        view.put("done", done);
        view.put("canDouble", !done && hand.player.size() == 2 && !hand.doubled);
        return view;
    }

    // ------------------------------------------------------------------ video poker

    @Transactional
    public Map<String, Object> pokerDeal(UUID userId, int bet, String currencyName) {
        checkInCasino(userId);
        Poker open = poker.get(userId);
        if (open != null) return pokerView(open, null, 0);
        checkBet(bet);
        Currency currency = currency(currencyName);
        pay(userId, currency, -bet, "videopoker");
        Poker hand = new Poker(CasinoGames.shoe(1, random), bet, currency);
        for (int i = 0; i < 5; i++) hand.hand.add(hand.deck.removeFirst());
        poker.put(userId, hand);
        Map<String, Object> view = pokerView(hand, null, 0);
        view.put("hint", CasinoGames.evaluatePoker(hand.hand).label);
        return view;
    }

    /** Si cambiano le carte non tenute e si paga la mano finale. */
    @Transactional
    public Map<String, Object> pokerDraw(UUID userId, List<Boolean> hold) {
        checkInCasino(userId);
        Poker hand = poker.remove(userId);
        if (hand == null) throw ApiException.conflict("casino_no_hand");
        for (int i = 0; i < 5; i++) {
            boolean keep = hold != null && i < hold.size() && Boolean.TRUE.equals(hold.get(i));
            if (!keep) hand.hand.set(i, hand.deck.removeFirst());
        }
        CasinoGames.PokerHand result = CasinoGames.evaluatePoker(hand.hand);
        // Paghe "per uno" come al video poker vero: con la coppia di J si riprende la puntata, con la
        // doppia coppia il doppio, con la scala reale 250 volte.
        int returned = hand.stake * result.pays;
        pay(userId, hand.currency, returned, "videopoker");
        Map<String, Object> view = result(userId, hand.currency, "Video poker", hand.stake, returned);
        view.putAll(pokerView(hand, result, returned));
        return view;
    }

    private static Map<String, Object> pokerView(Poker hand, CasinoGames.PokerHand result, int returned) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("cards", CasinoGames.codes(hand.hand));
        view.put("stake", hand.stake);
        view.put("currency", hand.currency.name().toLowerCase());
        view.put("done", result != null);
        if (result != null) {
            view.put("hand", result.label);
            view.put("handKey", result.name());
        }
        return view;
    }

    // ------------------------------------------------------------------ baccarat

    @Transactional
    public Map<String, Object> baccarat(UUID userId, Map<String, Integer> bets, String currencyName) {
        checkInCasino(userId);
        if (bets == null || bets.isEmpty()) throw ApiException.badRequest("casino_bad_bet");
        int total = 0;
        for (Map.Entry<String, Integer> e : bets.entrySet()) {
            int stake = Objects.requireNonNullElse(e.getValue(), 0);
            if (stake == 0) continue;
            checkBet(stake);
            if (CasinoGames.baccaratReturn(e.getKey(), stake, "tie") < 0) throw ApiException.badRequest("casino_bad_bet");
            total += stake;
        }
        if (total == 0 || total > MAX_TABLE_BET) throw ApiException.badRequest("casino_bad_bet");
        Currency currency = currency(currencyName);
        pay(userId, currency, -total, "baccarat");
        CasinoGames.BaccaratCoup coup = CasinoGames.playBaccarat(random);
        int returned = 0;
        for (Map.Entry<String, Integer> e : bets.entrySet()) {
            int stake = Objects.requireNonNullElse(e.getValue(), 0);
            if (stake > 0) returned += CasinoGames.baccaratReturn(e.getKey(), stake, coup.winner());
        }
        pay(userId, currency, returned, "baccarat");
        Map<String, Object> view = result(userId, currency, "Baccarat", total, returned);
        view.put("player", coup.player());
        view.put("banker", coup.banker());
        view.put("playerPoints", coup.playerPoints());
        view.put("bankerPoints", coup.bankerPoints());
        view.put("winner", coup.winner());
        return view;
    }

    // ------------------------------------------------------------------ dadi

    @Transactional
    public Map<String, Object> craps(UUID userId, int bet, String side, String currencyName) {
        checkInCasino(userId);
        checkBet(bet);
        boolean pass = !"dontpass".equals(side);
        Currency currency = currency(currencyName);
        pay(userId, currency, -bet, "dadi");
        CasinoGames.CrapsRound round = CasinoGames.playCraps(pass, random);
        int returned = switch (round.outcome()) {
            case "win" -> bet * 2;
            case "push" -> bet;
            default -> 0;
        };
        pay(userId, currency, returned, "dadi");
        Map<String, Object> view = result(userId, currency, "Dadi", bet, returned);
        view.put("rolls", round.rolls());
        view.put("point", round.point());
        view.put("outcome", round.outcome());
        view.put("side", pass ? "pass" : "dontpass");
        return view;
    }
}
