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
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Casino dell'hotel: cassa delle fiches e tavoli (vedi CasinoService). */
@Tag(name = Tags.CASINO, description = Tags.CASINO_INFO)
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
    @Operation(summary = "Fiches, gold, regalo del giorno e mani in sospeso")
    @GetMapping("/wallet")
    public Map<String, Object> wallet(@CurrentUser UserPrincipal principal) {
        return casino.wallet(principal.getId());
    }

    @Operation(summary = "Cambia gold in fiches o fiches in gold")
    @PostMapping("/exchange")
    public Map<String, Object> exchange(@CurrentUser UserPrincipal principal, @RequestBody ExchangeRequest body) {
        return casino.exchange(principal.getId(), body.action(), body.amount());
    }

    @Operation(summary = "Riscuote il regalo del giorno")
    @PostMapping("/bonus")
    public Map<String, Object> bonus(@CurrentUser UserPrincipal principal) {
        return casino.dailyBonus(principal.getId());
    }

    @Operation(summary = "Gioca alla slot machine")
    @PostMapping("/slot")
    public Map<String, Object> slot(@CurrentUser UserPrincipal principal, @RequestBody BetRequest body) {
        return casino.slot(principal.getId(), body.bet(), body.currency());
    }

    @Operation(summary = "Gioca alla roulette")
    @PostMapping("/roulette")
    public Map<String, Object> roulette(@CurrentUser UserPrincipal principal, @RequestBody RouletteRequest body) {
        return casino.roulette(principal.getId(), body.bets(), body.currency());
    }

    @Operation(summary = "Blackjack: distribuisce una mano")
    @PostMapping("/blackjack/deal")
    public Map<String, Object> blackjackDeal(@CurrentUser UserPrincipal principal, @RequestBody BetRequest body) {
        return casino.blackjackDeal(principal.getId(), body.bet(), body.currency());
    }

    /** hit, stand o double. */
    @Operation(summary = "Blackjack: carta, stai o raddoppia",
            description = "action: hit, stand o double.")
    @PostMapping("/blackjack/{action}")
    public Map<String, Object> blackjackAction(@CurrentUser UserPrincipal principal, @PathVariable String action) {
        return casino.blackjackAction(principal.getId(), action);
    }

    @Operation(summary = "Video poker: distribuisce una mano")
    @PostMapping("/poker/deal")
    public Map<String, Object> pokerDeal(@CurrentUser UserPrincipal principal, @RequestBody BetRequest body) {
        return casino.pokerDeal(principal.getId(), body.bet(), body.currency());
    }

    @Operation(summary = "Video poker: cambia le carte non tenute")
    @PostMapping("/poker/draw")
    public Map<String, Object> pokerDraw(@CurrentUser UserPrincipal principal, @RequestBody DrawRequest body) {
        return casino.pokerDraw(principal.getId(), body.hold());
    }

    @Operation(summary = "Gioca a baccarat")
    @PostMapping("/baccarat")
    public Map<String, Object> baccarat(@CurrentUser UserPrincipal principal, @RequestBody BaccaratRequest body) {
        return casino.baccarat(principal.getId(), body.bets(), body.currency());
    }

    /** side: "pass" o "dontpass". */
    @Operation(summary = "Gioca a craps",
            description = "side: \"pass\" o \"dontpass\".")
    @PostMapping("/craps")
    public Map<String, Object> craps(@CurrentUser UserPrincipal principal, @RequestBody BetRequest body) {
        return casino.craps(principal.getId(), body.bet(), body.side(), body.currency());
    }
}
