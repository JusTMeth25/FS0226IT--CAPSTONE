package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.dto.response.MissionDto;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.MissionService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = Tags.MISSIONI, description = Tags.MISSIONI_INFO)
@RestController
@RequestMapping("/api/missions")
public class MissionController {

    private final MissionService missionService;

    public MissionController(MissionService missionService) {
        this.missionService = missionService;
    }

    @Operation(summary = "Missioni e avanzamento")
    @GetMapping
    public Map<String, List<MissionDto>> listMissions(@CurrentUser UserPrincipal principal) {
        return Map.of("missions", missionService.listMissions(principal.getId()));
    }

    /**
     * Dichiarata prima di /{missionId}/claim: altrimenti "daily-login" verrebbe trattato
     * come il code di una missione e la richiesta finirebbe nella rotta generica.
     */
    @Operation(summary = "Riscuote il premio dell'accesso giornaliero")
    @PostMapping("/daily-login/claim")
    public MissionService.RewardResult claimDailyLogin(@CurrentUser UserPrincipal principal) {
        return missionService.claimDailyLogin(principal.getId());
    }

    @Operation(summary = "Riscuote il premio di una missione completata")
    @PostMapping("/{missionId}/claim")
    public MissionService.RewardResult claim(@CurrentUser UserPrincipal principal,
                                             @PathVariable String missionId) {
        return missionService.claim(principal.getId(), missionId);
    }
}
