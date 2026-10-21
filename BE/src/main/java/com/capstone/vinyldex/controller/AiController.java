package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.dto.request.AiRequests;
import com.capstone.vinyldex.service.OpenAiImageService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Generazione immagini.
 *
 * Riservato agli amministratori da SecurityConfig: ogni chiamata consuma credito OpenAI a pagamento,
 * quindi non puo' essere aperto a chiunque.
 */
@Tag(name = Tags.ADMIN, description = Tags.ADMIN_INFO)
@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final OpenAiImageService openAiImageService;

    public AiController(OpenAiImageService openAiImageService) {
        this.openAiImageService = openAiImageService;
    }

    @Operation(summary = "Genera immagini con OpenAI",
            description = "Ogni chiamata consuma credito OpenAI a pagamento.")
    @PostMapping("/generate-batch")
    public Map<String, Object> generateBatch(@Valid @RequestBody AiRequests.GenerateBatchRequest request) {
        List<OpenAiImageService.GenerationResult> results = openAiImageService.generateBatch(request);
        return Map.of("success", true, "results", results);
    }
}
