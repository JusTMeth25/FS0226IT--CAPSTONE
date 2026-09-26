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

/** Tornei a eliminazione e stagione sportiva dell'hotel. */
@RestController
@RequestMapping("/api/hotel")
public class SportController {

    private final TournamentService tournaments;
    private final SeasonService season;

    public SportController(TournamentService tournaments, SeasonService season) {
        this.tournaments = tournaments;
        this.season = season;
    }

    @GetMapping("/tournament")
    public Map<String, Object> tournament(@CurrentUser UserPrincipal principal) {
        return tournaments.view(principal.getId());
    }

    @PostMapping("/tournament/signup")
    public Map<String, Object> signup(@CurrentUser UserPrincipal principal) {
        return tournaments.signup(principal.getId());
    }

    @PostMapping("/tournament/withdraw")
    public Map<String, Object> withdraw(@CurrentUser UserPrincipal principal) {
        return tournaments.withdraw(principal.getId());
    }

    @GetMapping("/season")
    public Map<String, Object> season(@CurrentUser UserPrincipal principal) {
        return season.view(principal.getId());
    }
}
