package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.dto.request.GameRequests;
import com.capstone.vinyldex.dto.response.EventDto;
import com.capstone.vinyldex.dto.response.LeaderboardEntryDto;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.BattleService;
import com.capstone.vinyldex.service.EventService;
import com.capstone.vinyldex.service.LeaderboardService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;

/** Endpoint di contorno: eventi, classifiche e ricompense di battaglia. */
@RestController
@RequestMapping("/api")
public class GameController {

    private final EventService eventService;
    private final LeaderboardService leaderboardService;
    private final BattleService battleService;

    private com.capstone.vinyldex.service.GameLeaderboardService gameLeaderboardService;

    @org.springframework.beans.factory.annotation.Autowired
    void setGameLeaderboardService(com.capstone.vinyldex.service.GameLeaderboardService gameLeaderboardService) {
        this.gameLeaderboardService = gameLeaderboardService;
    }

    public GameController(EventService eventService,
                          LeaderboardService leaderboardService,
                          BattleService battleService) {
        this.eventService = eventService;
        this.leaderboardService = leaderboardService;
        this.battleService = battleService;
    }

    @Tag(name = Tags.EVENTI, description = Tags.EVENTI_INFO)
    @Operation(summary = "Eventi attivi")
    @SecurityRequirements
    @GetMapping("/events")
    public Map<String, List<EventDto>> events() {
        return Map.of("events", eventService.listActive());
    }

    /** Classifica di un gioco (carte diverse possedute) con il premio settimanale. */
    @Tag(name = Tags.CLASSIFICA, description = Tags.CLASSIFICA_INFO)
    @Operation(summary = "Classifica di un gioco con il premio settimanale")
    @GetMapping("/leaderboard/games")
    public Map<String, Object> gameLeaderboard(@RequestParam(required = false) String source) {
        return gameLeaderboardService.leaderboard(source);
    }

    @Tag(name = Tags.CLASSIFICA, description = Tags.CLASSIFICA_INFO)
    @Operation(summary = "Classifica generale")
    @SecurityRequirements
    @GetMapping("/leaderboard")
    public Map<String, List<LeaderboardEntryDto>> leaderboard(
            @RequestParam(required = false, defaultValue = "collection") String type) {
        return Map.of("entries", leaderboardService.getLeaderboard(type));
    }

    @Tag(name = Tags.BATTAGLIE, description = Tags.BATTAGLIE_INFO)
    @Operation(summary = "Riscuote la ricompensa di una battaglia")
    @PostMapping("/battles/reward")
    public BattleService.BattleRewardResult battleReward(@CurrentUser UserPrincipal principal,
                                                         @Valid @RequestBody GameRequests.BattleRewardRequest request) {
        return battleService.grantReward(principal.getId(), request);
    }
}
