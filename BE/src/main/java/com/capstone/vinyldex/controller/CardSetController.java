package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.CardSetService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Set da completare: avanzamento, premi e distintivi. */
@Tag(name = Tags.COLLEZIONE, description = Tags.COLLEZIONE_INFO)
@RestController
@RequestMapping("/api/sets")
public class CardSetController {

    private final CardSetService setService;

    public CardSetController(CardSetService setService) {
        this.setService = setService;
    }

    @Operation(summary = "Avanzamento dei set da completare")
    @GetMapping
    public Map<String, Object> progress(@CurrentUser UserPrincipal principal) {
        return Map.of("sets", setService.progress(principal.getId()), "badges", setService.badges(principal.getId()));
    }

    @Operation(summary = "Riscuote il premio di un set completato")
    @PostMapping("/{key}/claim")
    public Map<String, Object> claim(@CurrentUser UserPrincipal principal, @PathVariable String key) {
        return setService.claim(principal.getId(), key);
    }
}
