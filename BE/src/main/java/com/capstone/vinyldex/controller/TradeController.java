package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.dto.request.GameRequests;
import com.capstone.vinyldex.dto.response.NpcTradeDto;
import com.capstone.vinyldex.dto.response.TradeDto;
import com.capstone.vinyldex.hotel.NpcDeals;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.TradeService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = Tags.SCAMBI, description = Tags.SCAMBI_INFO)
@RestController
@RequestMapping("/api/trades")
public class TradeController {

    private final TradeService tradeService;
    private final NpcDeals npcDeals;

    public TradeController(TradeService tradeService, NpcDeals npcDeals) {
        this.tradeService = tradeService;
        this.npcDeals = npcDeals;
    }

    /** Scambi conclusi con gli NPC dell'hotel (gli ultimi 50). */
    @Operation(summary = "Ultimi scambi conclusi con gli NPC dell'hotel")
    @GetMapping("/npc")
    public Map<String, List<NpcTradeDto>> npc(@CurrentUser UserPrincipal principal) {
        return Map.of("trades", npcDeals.history(principal.getId()));
    }

    @Operation(summary = "Propone uno scambio")
    @PostMapping
    public ResponseEntity<Map<String, TradeDto>> create(@CurrentUser UserPrincipal principal,
                                                        @Valid @RequestBody GameRequests.TradeCreateRequest request) {
        TradeDto trade = tradeService.create(principal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("trade", trade));
    }

    @Operation(summary = "Proposte ricevute")
    @GetMapping("/incoming")
    public Map<String, List<TradeDto>> incoming(@CurrentUser UserPrincipal principal) {
        return Map.of("trades", tradeService.incoming(principal.getId()));
    }

    @Operation(summary = "Proposte inviate")
    @GetMapping("/outgoing")
    public Map<String, List<TradeDto>> outgoing(@CurrentUser UserPrincipal principal) {
        return Map.of("trades", tradeService.outgoing(principal.getId()));
    }

    @Operation(summary = "Accetta una proposta")
    @PostMapping("/{id}/accept")
    public Map<String, TradeDto> accept(@CurrentUser UserPrincipal principal, @PathVariable UUID id) {
        return Map.of("trade", tradeService.accept(principal.getId(), id));
    }

    @Operation(summary = "Rifiuta una proposta")
    @PostMapping("/{id}/reject")
    public Map<String, TradeDto> reject(@CurrentUser UserPrincipal principal, @PathVariable UUID id) {
        return Map.of("trade", tradeService.reject(principal.getId(), id));
    }

    @Operation(summary = "Annulla una propria proposta")
    @PostMapping("/{id}/cancel")
    public Map<String, TradeDto> cancel(@CurrentUser UserPrincipal principal, @PathVariable UUID id) {
        return Map.of("trade", tradeService.cancel(principal.getId(), id));
    }
}
