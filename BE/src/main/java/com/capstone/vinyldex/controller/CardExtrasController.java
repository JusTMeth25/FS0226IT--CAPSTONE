package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.CardExtrasService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Carta del giorno, storico prezzi, fusione dei doppioni. */
@RestController
@RequestMapping("/api")
public class CardExtrasController {

    private final CardExtrasService service;
    private final com.capstone.vinyldex.service.MarketSalesService marketSales;

    public CardExtrasController(CardExtrasService service, com.capstone.vinyldex.service.MarketSalesService marketSales) {
        this.service = service;
        this.marketSales = marketSales;
    }

    /** Borsa del mercato: vendite fra giocatori di una carta (pubblico come il resto di /api/cards). */
    @GetMapping("/cards/{code}/market-sales")
    public Map<String, Object> marketSales(@PathVariable String code) {
        return marketSales.history(code);
    }

    /** Prezzo medio fra giocatori di ogni carta venduta almeno una volta. */
    @GetMapping("/market/averages")
    public Map<String, Integer> marketAverages() {
        return marketSales.averages();
    }

    public record FuseDto(List<String> cards) {
    }

    /** Pubblica (come il resto di /api/cards): con il login dice anche se l'hai e se hai gia' vinto la sfida. */
    @GetMapping("/cards/daily")
    public Map<String, Object> daily(@CurrentUser UserPrincipal principal) {
        return service.daily(principal == null ? null : principal.getId());
    }

    @GetMapping("/cards/{code}/price-history")
    public Map<String, Object> priceHistory(@PathVariable String code) {
        return service.priceHistory(code);
    }

    @GetMapping("/fusion")
    public Map<String, Object> candidates(@CurrentUser UserPrincipal principal) {
        return service.fusionCandidates(principal.getId());
    }

    @PostMapping("/fusion")
    public Map<String, Object> fuse(@CurrentUser UserPrincipal principal, @RequestBody FuseDto body) {
        return service.fuse(principal.getId(), body.cards());
    }
}
