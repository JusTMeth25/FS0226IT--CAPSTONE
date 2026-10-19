package com.capstone.vinyldex.stock;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.service.WalletService;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.random.RandomGenerator;

/**
 * Borsa di Wall Street: tiene vivo il mercato (StockMarket), salva le quotazioni per i grafici,
 * fa comprare e vendere azioni ai giocatori con i gold e fa fare trading anche agli NPC.
 *
 * Commissione dello 0,5% su ogni ordine (almeno 1 gold): il mercato in media non regala niente.
 */
@Service
public class StockService {

    private static final Logger log = LoggerFactory.getLogger(StockService.class);
    static final double FEE = 0.005;
    static final int MAX_SHARES = 100_000;
    private static final long TICK_MS = 5_000;
    private static final String[] TRADERS = {"Il Lupo", "Gordon G.", "Miss Dow", "Jordan B.", "Bull Bianchi", "Orso Rossi",
            "Mr. Nasdaq", "La Volpe", "Zio Paperone", "Dottor Spread"};

    private final JdbcTemplate jdbc;
    private final WalletService walletService;
    private final UserRepository userRepository;
    private final RandomGenerator random = new SecureRandom();
    private final StockMarket market = new StockMarket(random);
    /** Una quotazione al minuto per titolo, l'ultima settimana (per i grafici). */
    private final Map<String, Deque<double[]>> minutes = new ConcurrentHashMap<>();
    private final Deque<Map<String, Object>> feed = new ArrayDeque<>();
    private final ScheduledExecutorService clock = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "stock-market");
        t.setDaemon(true);
        return t;
    });
    private volatile boolean ready;
    private long lastMinute;

    public StockService(JdbcTemplate jdbc, WalletService walletService, UserRepository userRepository) {
        this.jdbc = jdbc;
        this.walletService = walletService;
        this.userRepository = userRepository;
    }

    // ------------------------------------------------------------------ avvio e ciclo

    /** Quota i titoli che mancano, rilegge prezzi e storico, poi fa partire il mercato. */
    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        try {
            for (StockMarket.Listing l : StockMarket.LISTINGS) {
                double f = fundamental(l);
                List<Map<String, Object>> row = jdbc.queryForList("select k, price from stocks where symbol = ?", l.symbol());
                if (row.isEmpty()) {
                    double price = StockMarket.listingPrice(f);
                    double k = f > 0 ? price / f : 1;
                    jdbc.update("insert into stocks (symbol, name, k, price) values (?, ?, ?, ?)", l.symbol(), l.name(), k, price);
                    market.list(l, k, price, f > 0 ? f : price);
                } else {
                    double k = ((Number) row.getFirst().get("k")).doubleValue();
                    double price = ((Number) row.getFirst().get("price")).doubleValue();
                    market.list(l, k, price, f > 0 ? f : price / k);
                }
                Deque<double[]> list = new ArrayDeque<>();
                jdbc.query("select at, price from stock_prices where symbol = ? and at > now() - interval '7 days' order by at", rs -> {
                    list.addLast(new double[]{rs.getTimestamp("at").getTime(), rs.getDouble("price")});
                }, l.symbol());
                minutes.put(l.symbol(), list);
            }
            ready = true;
            clock.scheduleAtFixedRate(this::tick, TICK_MS, TICK_MS, TimeUnit.MILLISECONDS);
            clock.scheduleWithFixedDelay(this::refreshFundamentals, 30, 30, TimeUnit.MINUTES);
        } catch (Exception ex) {
            log.warn("Borsa: avvio non riuscito", ex);
        }
    }

    /**
     * Fondamentale: prezzo medio (dollari) delle 100 carte piu' preziose del gioco; per l'indice
     * delle 300 piu' preziose di tutto il catalogo.
     */
    double fundamental(StockMarket.Listing l) {
        // I giochi vanno nella query come parametri (?), non scritti dentro il testo.
        String filter = l.sources().isEmpty() ? "" : " and source in (" + String.join(",", l.sources().stream().map(s -> "?").toList()) + ")";
        int top = l.sources().isEmpty() ? 300 : 100;
        String sql = "select avg(p) from (select (metadata->>'marketPrice')::numeric as p from cards"
                + " where is_active and (metadata->>'marketPrice') ~ '^[0-9.]+$'" + filter
                + " order by p desc limit " + top + ") t";
        Double v = jdbc.queryForObject(sql, Double.class, l.sources().toArray());
        return v == null ? 0 : v;
    }

    private void refreshFundamentals() {
        try {
            for (StockMarket.Listing l : StockMarket.LISTINGS) market.setFundamental(l.symbol(), fundamental(l));
        } catch (Exception ex) {
            log.debug("Borsa: fondamentali non aggiornati", ex);
        }
    }

    private void tick() {
        try {
            long now = System.currentTimeMillis();
            // Gli NPC trader comprano e vendono: muovono i prezzi e riempiono il nastro degli scambi.
            if (random.nextInt(3) == 0) npcTrade();
            market.tick(now);
            if (now - lastMinute >= 60_000) {
                lastMinute = now;
                saveMinute(now);
            }
        } catch (Exception ex) {
            log.debug("Borsa: tick non riuscito", ex);
        }
    }

    private void npcTrade() {
        List<StockMarket.Stock> all = market.all();
        StockMarket.Stock s = all.get(random.nextInt(all.size()));
        boolean buy = random.nextDouble() < 0.5 + 0.15 * Math.signum(Math.log(s.target() / s.price()));
        int shares = (1 + random.nextInt(40)) * (random.nextInt(8) == 0 ? 25 : 1);
        market.order(s.listing.symbol(), buy ? shares : -shares);
        addFeed(TRADERS[random.nextInt(TRADERS.length)], buy, s.listing.symbol(), shares, s.price(), true);
    }

    private void saveMinute(long now) {
        Timestamp at = Timestamp.from(Instant.ofEpochMilli(now - now % 60_000));
        for (StockMarket.Stock s : market.all()) {
            String sym = s.listing.symbol();
            jdbc.update("insert into stock_prices (symbol, at, price) values (?, ?, ?) on conflict do nothing", sym, at, s.price());
            jdbc.update("update stocks set price = ? where symbol = ?", s.price(), sym);
            Deque<double[]> list = minutes.computeIfAbsent(sym, k -> new ArrayDeque<>());
            synchronized (list) {
                list.addLast(new double[]{at.getTime(), s.price()});
                while (!list.isEmpty() && list.peekFirst()[0] < now - Duration.ofDays(7).toMillis()) list.removeFirst();
            }
        }
        if (now % 3_600_000 < 60_000) jdbc.update("delete from stock_prices where at < now() - interval '8 days'");
    }

    private synchronized void addFeed(String who, boolean buy, String symbol, int shares, double price, boolean npc) {
        Map<String, Object> f = new LinkedHashMap<>();
        f.put("who", who);
        f.put("side", buy ? "buy" : "sell");
        f.put("symbol", symbol);
        f.put("shares", shares);
        f.put("price", price);
        f.put("npc", npc);
        f.put("at", System.currentTimeMillis());
        feed.addFirst(f);
        while (feed.size() > 30) feed.removeLast();
    }

    // ------------------------------------------------------------------ viste

    private double changeOf(String symbol, double price) {
        Deque<double[]> list = minutes.get(symbol);
        if (list == null || list.isEmpty()) return 0;
        long day = System.currentTimeMillis() - Duration.ofDays(1).toMillis();
        double base = list.peekFirst()[1];
        synchronized (list) {
            for (double[] p : list) {
                if (p[0] > day) break;
                base = p[1];
            }
        }
        return base > 0 ? Math.round((price / base - 1) * 10_000) / 100.0 : 0;
    }

    /** Listino, nastro degli scambi e portafoglio di chi guarda. */
    public Map<String, Object> view(UUID userId) {
        if (!ready) throw new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "stock_closed", null);
        List<Map<String, Object>> list = new ArrayList<>();
        for (StockMarket.Stock s : market.all()) {
            Map<String, Object> m = new LinkedHashMap<>();
            String sym = s.listing.symbol();
            m.put("symbol", sym);
            m.put("name", s.listing.name());
            m.put("price", s.price());
            m.put("change", changeOf(sym, s.price()));
            m.put("spark", spark(sym, s));
            list.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("stocks", list);
        synchronized (this) {
            out.put("feed", new ArrayList<>(feed).subList(0, Math.min(15, feed.size())));
        }
        out.put("fee", FEE);
        if (userId != null) out.put("portfolio", portfolio(userId));
        return out;
    }

    /** Ultima ora, un punto ogni due minuti (piu' il prezzo di adesso): per i mini grafici del listino. */
    private List<Double> spark(String symbol, StockMarket.Stock s) {
        List<Double> out = new ArrayList<>();
        Deque<double[]> list = minutes.get(symbol);
        long from = System.currentTimeMillis() - Duration.ofHours(1).toMillis();
        if (list != null) {
            synchronized (list) {
                int i = 0;
                for (double[] p : list) if (p[0] >= from && i++ % 2 == 0) out.add(p[1]);
            }
        }
        out.add(s.price());
        return out;
    }

    /** Storico per il grafico grande: 1h (al minuto, piu' gli ultimi tick), 24h (5 minuti), 7d (ora). */
    public Map<String, Object> history(String symbol, String range) {
        StockMarket.Stock s = market.stock(symbol);
        if (s == null) throw ApiException.notFound("stock_not_found");
        long now = System.currentTimeMillis();
        long span = switch (range) {
            case "7d" -> Duration.ofDays(7).toMillis();
            case "24h" -> Duration.ofDays(1).toMillis();
            default -> Duration.ofHours(1).toMillis();
        };
        long bucket = switch (range) {
            case "7d" -> 3_600_000L;
            case "24h" -> 300_000L;
            default -> 60_000L;
        };
        Map<Long, double[]> buckets = new LinkedHashMap<>();
        Deque<double[]> list = minutes.get(symbol);
        if (list != null) {
            synchronized (list) {
                for (double[] p : list) {
                    if (p[0] < now - span) continue;
                    long key = (long) p[0] / bucket * bucket;
                    buckets.computeIfAbsent(key, k -> new double[]{p[1], p[1], p[1], p[1]});
                    double[] c = buckets.get(key);
                    c[1] = Math.max(c[1], p[1]);
                    c[2] = Math.min(c[2], p[1]);
                    c[3] = p[1];
                }
            }
        }
        List<Map<String, Object>> points = new ArrayList<>();
        buckets.forEach((at, c) -> points.add(Map.of("at", at, "open", c[0], "high", c[1], "low", c[2], "close", c[3])));
        if ("1h".equals(range) || points.isEmpty()) {
            // Gli ultimi tick (ogni 5 secondi) rendono vivo il grafico dell'ora.
            synchronized (market) {
                for (double[] p : s.recent) {
                    if (!points.isEmpty() && p[0] <= (long) points.getLast().get("at") + bucket) continue;
                    points.add(Map.of("at", (long) p[0], "open", p[1], "high", p[1], "low", p[1], "close", p[1]));
                }
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("symbol", symbol);
        out.put("name", s.listing.name());
        out.put("price", s.price());
        out.put("change", changeOf(symbol, s.price()));
        out.put("points", points);
        return out;
    }

    public List<Map<String, Object>> portfolio(UUID userId) {
        List<Map<String, Object>> out = new ArrayList<>();
        jdbc.query("select symbol, shares, cost from user_stocks where user_id = ? and shares > 0 order by symbol", rs -> {
            StockMarket.Stock s = market.stock(rs.getString("symbol"));
            if (s == null) return;
            int shares = rs.getInt("shares");
            long value = Math.round(shares * s.price());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("symbol", s.listing.symbol());
            m.put("shares", shares);
            m.put("cost", rs.getLong("cost"));
            m.put("value", value);
            m.put("pnl", value - rs.getLong("cost"));
            out.add(m);
        }, userId);
        return out;
    }

    // ------------------------------------------------------------------ ordini

    /** Compra o vende al prezzo di adesso; i gold passano dal portafoglio (movimento STOCK). */
    @Transactional
    public Map<String, Object> trade(UUID userId, String symbol, String side, int shares) {
        if (!ready) throw new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "stock_closed", null);
        StockMarket.Stock s = market.stock(symbol);
        if (s == null) throw ApiException.notFound("stock_not_found");
        if (shares < 1 || shares > MAX_SHARES) throw ApiException.badRequest("stock_bad_shares");
        boolean buy = "buy".equalsIgnoreCase(side);
        if (!buy && !"sell".equalsIgnoreCase(side)) throw ApiException.badRequest("stock_bad_side");
        double price = s.price();
        long total = Math.round(price * shares);
        long fee = Math.max(1, Math.round(total * FEE));
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("user_not_found"));
        if (buy) {
            if (total + fee > Integer.MAX_VALUE) throw ApiException.badRequest("stock_bad_shares");
            walletService.adjustGold(userId, (int) -(total + fee), WalletTransactionType.STOCK, "stock:" + symbol,
                    "Comprate " + shares + " azioni " + symbol + " a " + price);
            jdbc.update("""
                    insert into user_stocks (user_id, symbol, shares, cost) values (?, ?, ?, ?)
                    on conflict (user_id, symbol) do update set shares = user_stocks.shares + excluded.shares, cost = user_stocks.cost + excluded.cost""",
                    userId, symbol, shares, total + fee);
        } else {
            List<Map<String, Object>> held = jdbc.queryForList("select shares, cost from user_stocks where user_id = ? and symbol = ? for update", userId, symbol);
            int have = held.isEmpty() ? 0 : ((Number) held.getFirst().get("shares")).intValue();
            if (have < shares) throw ApiException.badRequest("stock_not_enough_shares");
            long cost = ((Number) held.getFirst().get("cost")).longValue();
            long costOut = Math.round((double) cost * shares / have);
            jdbc.update("update user_stocks set shares = shares - ?, cost = cost - ? where user_id = ? and symbol = ?", shares, costOut, userId, symbol);
            long gain = Math.max(0, total - fee);
            if (gain > 0) walletService.adjustGold(userId, (int) Math.min(Integer.MAX_VALUE, gain), WalletTransactionType.STOCK,
                    "stock:" + symbol, "Vendute " + shares + " azioni " + symbol + " a " + price);
        }
        market.order(symbol, buy ? shares : -shares);
        addFeed(user.getUsername(), buy, symbol, shares, price, false);
        Map<String, Object> out = view(userId);
        out.put("done", Map.of("symbol", symbol, "side", buy ? "buy" : "sell", "shares", shares, "price", price, "total", total, "fee", fee));
        out.put("gold", userRepository.findById(userId).map(User::getGold).orElse(0));
        return out;
    }

    // Per i test.
    StockMarket market() {
        return market;
    }

    @PreDestroy
    void shutdown() {
        clock.shutdownNow();
    }
}
