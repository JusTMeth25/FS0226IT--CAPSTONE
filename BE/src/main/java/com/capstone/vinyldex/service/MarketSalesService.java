package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Borsa del mercato: le vendite fra giocatori (mercato e banchetti dell'hotel). Da qui il prezzo
 * medio in gold di ogni carta, accanto allo storico dei prezzi esterni in dollari.
 */
@Service
public class MarketSalesService {

    private final JdbcTemplate jdbc;
    private final CardRepository cardRepository;

    public MarketSalesService(JdbcTemplate jdbc, CardRepository cardRepository) {
        this.jdbc = jdbc;
        this.cardRepository = cardRepository;
    }

    /** Registra una vendita: `price` e' il prezzo di una copia. */
    @Transactional
    public void record(UUID cardId, int price, int quantity, String channel) {
        jdbc.update("INSERT INTO market_sales (card_id, price, quantity, channel) VALUES (?, ?, ?, ?)",
                cardId, price, Math.max(1, quantity), channel);
    }

    /** Media giornaliera degli ultimi 30 giorni, ultimo prezzo e numero di vendite di una carta. */
    @Transactional(readOnly = true)
    public Map<String, Object> history(String code) {
        Card card = cardRepository.findByCode(code).orElseThrow(() -> ApiException.notFound("card_not_found"));
        List<Map<String, Object>> points = new ArrayList<>();
        jdbc.query("SELECT (sold_at AT TIME ZONE 'Europe/Rome')::date AS day, "
                + "ROUND(SUM(price * quantity)::numeric / SUM(quantity), 0) AS avg, SUM(quantity) AS sold "
                + "FROM market_sales WHERE card_id = ? AND sold_at > now() - interval '30 days' GROUP BY 1 ORDER BY 1", rs -> {
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("day", rs.getDate("day").toString());
            point.put("price", rs.getInt("avg"));
            point.put("sold", rs.getInt("sold"));
            points.add(point);
        }, card.getId());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("points", points);
        result.put("last", jdbc.queryForList("SELECT price FROM market_sales WHERE card_id = ? ORDER BY sold_at DESC LIMIT 1",
                Integer.class, card.getId()).stream().findFirst().orElse(null));
        result.put("average", jdbc.queryForObject("SELECT ROUND(SUM(price * quantity)::numeric / NULLIF(SUM(quantity), 0), 0) "
                + "FROM market_sales WHERE card_id = ?", Integer.class, card.getId()));
        result.put("sales", jdbc.queryForObject("SELECT COALESCE(SUM(quantity), 0) FROM market_sales WHERE card_id = ?",
                Integer.class, card.getId()));
        return result;
    }

    /** Prezzo medio fra giocatori per ogni carta che ha almeno una vendita (per gli annunci del mercato). */
    @Transactional(readOnly = true)
    public Map<String, Integer> averages() {
        Map<String, Integer> result = new HashMap<>();
        jdbc.query("SELECT c.code, ROUND(SUM(s.price * s.quantity)::numeric / SUM(s.quantity), 0) AS avg "
                + "FROM market_sales s JOIN cards c ON c.id = s.card_id GROUP BY c.code",
                rs -> { result.put(rs.getString("code"), rs.getInt("avg")); });
        return result;
    }
}
