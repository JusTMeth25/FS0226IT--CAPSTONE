package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.BattleOpponentService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Avversari della pagina Battaglie: giocatori da affrontare con la loro squadra, o online in tempo reale. */
@RestController
@RequestMapping("/api/battles")
public class BattleOpponentController {

    private final BattleOpponentService opponents;

    public BattleOpponentController(BattleOpponentService opponents) {
        this.opponents = opponents;
    }

    @GetMapping("/opponents")
    public Map<String, List<Map<String, Object>>> opponents(@CurrentUser UserPrincipal principal,
                                                            @RequestParam(required = false) String q) {
        return Map.of("opponents", opponents.opponents(principal.getId(), q));
    }

    @GetMapping("/opponents/{id}/team")
    public Map<String, Object> team(@CurrentUser UserPrincipal principal, @PathVariable UUID id) {
        return opponents.team(principal.getId(), id);
    }

    @GetMapping("/online")
    public Map<String, List<Map<String, Object>>> online(@CurrentUser UserPrincipal principal) {
        return Map.of("players", opponents.online(principal.getId()));
    }
}
