package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.GradingService;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Il perito dell'hotel: gradazione di una carta della propria collezione. */
@Tag(name = Tags.COLLEZIONE, description = Tags.COLLEZIONE_INFO)
@RestController
@RequestMapping("/api/grading")
public class GradingController {

    private final GradingService gradingService;

    public GradingController(GradingService gradingService) {
        this.gradingService = gradingService;
    }

    @Operation(summary = "Fa gradare una carta dal perito dell'hotel")
    @PostMapping("/{cardCode}")
    public Map<String, Object> grade(@CurrentUser UserPrincipal principal, @PathVariable String cardCode) {
        return gradingService.grade(principal.getId(), cardCode);
    }
}
