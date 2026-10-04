package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.casino.CasinoService;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Casino dell'hotel: cassa delle fiches e tavoli (vedi CasinoService). */
@RestController
@RequestMapping("/api/casino")
public class CasinoController {

    private final CasinoService casino;

    public CasinoController(CasinoService casino) {
        this.casino = casino;
    }

    public record ExchangeRequest(String action, int amount) {
    }

    public record BetRequest(int bet, String currency, String side) {
    }

    public record RouletteRequest(List<CasinoService.RouletteBet> bets, String currency) {
    }

    public record BaccaratRequest(Map<String, Integer> bets, String currency) {
    }

    public record DrawRequest(List<Boolean> hold) {
    }

    /** Fiches, gold, regalo del giorno e mani lasciate a meta' (blackjack, video poker). */
    @GetMapping("/wallet")
    public Map<String, Object> wallet(@CurrentUser UserPrincipal principal) {
        return casino.wallet(principal.getId());
    }

    @PostMapping("/exchange")
    public Map<String, Object> exchange(@CurrentUser UserPrincipal principal, @RequestBody ExchangeRequest body) {
        return casino.exchange(principal.getId(), body.action(), body.amount());
    }

    @PostMapping("/bonus")
    public Map<String, Object> bonus(@CurrentUser UserPrincipal principal) {
        return casino.dailyBonus(principal.getId());
    }

    @PostMapping("/slot")
    public Map<String, Object> slot(@CurrentUser UserPrincipal principal, @RequestBody BetRequest body) {
        return casino.slot(principal.getId(), body.bet(), body.currency());
    }

    @PostMapping("/roulette")
    public Map<String, Object> roulette(@CurrentUser UserPrincipal principal, @RequestBody RouletteRequest body) {
        return casino.roulette(principal.getId(), body.bets(), body.currency());
    }

    @PostMapping("/blackjack/deal")
    public Map<String, Object> blackjackDeal(@CurrentUser UserPrincipal principal, @RequestBody BetRequest body) {
        return casino.blackjackDeal(principal.getId(), body.bet(), body.currency());
    }

    /** hit, stand o double. */
    @PostMapping("/blackjack/{action}")
    public Map<String, Object> blackjackAction(@CurrentUser UserPrincipal principal, @PathVariable String action) {
        return casino.blackjackAction(principal.getId(), action);
    }

    @PostMapping("/poker/deal")
    public Map<String, Object> pokerDeal(@CurrentUser UserPrincipal principal, @RequestBody BetRequest body) {
        return casino.pokerDeal(principal.getId(), body.bet(), body.currency());
    }

    @PostMapping("/poker/draw")
    public Map<String, Object> pokerDraw(@CurrentUser UserPrincipal principal, @RequestBody DrawRequest body) {
        return casino.pokerDraw(principal.getId(), body.hold());
    }

    @PostMapping("/baccarat")
    public Map<String, Object> baccarat(@CurrentUser UserPrincipal principal, @RequestBody BaccaratRequest body) {
        return casino.baccarat(principal.getId(), body.bets(), body.currency());
    }

    /** side: "pass" o "dontpass". */
    @PostMapping("/craps")
    public Map<String, Object> craps(@CurrentUser UserPrincipal principal, @RequestBody BetRequest body) {
        return casino.craps(principal.getId(), body.bet(), body.side(), body.currency());
    }
}
