package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.BattleOpponentService;
import com.capstone.vinyldex.service.UserActivity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Avversari della pagina Battaglie: giocatori da affrontare con la loro squadra, o online in tempo reale. */
@Tag(name = Tags.BATTAGLIE, description = Tags.BATTAGLIE_INFO)
@RestController
@RequestMapping("/api/battles")
public class BattleOpponentController {

    private final BattleOpponentService opponents;
    private final UserActivity activity;

    public BattleOpponentController(BattleOpponentService opponents, UserActivity activity) {
        this.opponents = opponents;
        this.activity = activity;
    }

    /** Battaglia contro gli NPC iniziata o finita: nel frattempo non si ricevono proposte di scambio. */
    @Operation(summary = "Segnala l'inizio o la fine di una battaglia contro gli NPC",
            description = "Durante la battaglia non si ricevono proposte di scambio.")
    @PostMapping("/activity")
    public Map<String, Boolean> activity(@CurrentUser UserPrincipal principal, @RequestBody Map<String, Boolean> body) {
        boolean busy = Boolean.TRUE.equals(body.get("busy"));
        activity.setInBattle(principal.getId(), busy);
        return Map.of("busy", busy);
    }

    @Operation(summary = "Giocatori da sfidare")
    @GetMapping("/opponents")
    public Map<String, List<Map<String, Object>>> opponents(@CurrentUser UserPrincipal principal,
                                                            @RequestParam(required = false) String q) {
        return Map.of("opponents", opponents.opponents(principal.getId(), q));
    }

    @Operation(summary = "Squadra di un avversario")
    @GetMapping("/opponents/{id}/team")
    public Map<String, Object> team(@CurrentUser UserPrincipal principal, @PathVariable UUID id) {
        return opponents.team(principal.getId(), id);
    }

    @Operation(summary = "Giocatori online da sfidare in tempo reale")
    @GetMapping("/online")
    public Map<String, List<Map<String, Object>>> online(@CurrentUser UserPrincipal principal) {
        return Map.of("players", opponents.online(principal.getId()));
    }
}
