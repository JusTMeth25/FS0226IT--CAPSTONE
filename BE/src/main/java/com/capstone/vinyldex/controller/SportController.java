package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.hotel.SeasonService;
import com.capstone.vinyldex.hotel.TournamentService;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Tornei a eliminazione e stagione sportiva dell'hotel. */
@Tag(name = Tags.HOTEL, description = Tags.HOTEL_INFO)
@RestController
@RequestMapping("/api/hotel")
public class SportController {

    private final TournamentService tournaments;
    private final SeasonService season;

    public SportController(TournamentService tournaments, SeasonService season) {
        this.tournaments = tournaments;
        this.season = season;
    }

    @Operation(summary = "Torneo a eliminazione dell'hotel")
    @GetMapping("/tournament")
    public Map<String, Object> tournament(@CurrentUser UserPrincipal principal) {
        return tournaments.view(principal.getId());
    }

    @Operation(summary = "Iscrizione al torneo")
    @PostMapping("/tournament/signup")
    public Map<String, Object> signup(@CurrentUser UserPrincipal principal) {
        return tournaments.signup(principal.getId());
    }

    @Operation(summary = "Ritiro dal torneo")
    @PostMapping("/tournament/withdraw")
    public Map<String, Object> withdraw(@CurrentUser UserPrincipal principal) {
        return tournaments.withdraw(principal.getId());
    }

    @Operation(summary = "Stagione sportiva dell'hotel")
    @GetMapping("/season")
    public Map<String, Object> season(@CurrentUser UserPrincipal principal) {
        return season.view(principal.getId());
    }
}
