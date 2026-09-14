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

/** Endpoint di contorno: eventi, classifiche e ricompense di battaglia. */
@RestController
@RequestMapping("/api")
public class GameController {

    private final EventService eventService;
    private final LeaderboardService leaderboardService;
    private final BattleService battleService;

    public GameController(EventService eventService,
                          LeaderboardService leaderboardService,
                          BattleService battleService) {
        this.eventService = eventService;
        this.leaderboardService = leaderboardService;
        this.battleService = battleService;
    }

    @GetMapping("/events")
    public Map<String, List<EventDto>> events() {
        return Map.of("events", eventService.listActive());
    }

    @GetMapping("/leaderboard")
    public Map<String, List<LeaderboardEntryDto>> leaderboard(
            @RequestParam(required = false, defaultValue = "collection") String type) {
        return Map.of("entries", leaderboardService.getLeaderboard(type));
    }

    @PostMapping("/battles/reward")
    public BattleService.BattleRewardResult battleReward(@CurrentUser UserPrincipal principal,
                                                         @Valid @RequestBody GameRequests.BattleRewardRequest request) {
        return battleService.grantReward(principal.getId(), request);
    }
}
