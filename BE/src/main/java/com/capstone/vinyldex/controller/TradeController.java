package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.dto.request.GameRequests;
import com.capstone.vinyldex.dto.response.TradeDto;
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

@RestController
@RequestMapping("/api/trades")
public class TradeController {

    private final TradeService tradeService;

    public TradeController(TradeService tradeService) {
        this.tradeService = tradeService;
    }

    @PostMapping
    public ResponseEntity<Map<String, TradeDto>> create(@CurrentUser UserPrincipal principal,
                                                        @Valid @RequestBody GameRequests.TradeCreateRequest request) {
        TradeDto trade = tradeService.create(principal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("trade", trade));
    }

    @GetMapping("/incoming")
    public Map<String, List<TradeDto>> incoming(@CurrentUser UserPrincipal principal) {
        return Map.of("trades", tradeService.incoming(principal.getId()));
    }

    @GetMapping("/outgoing")
    public Map<String, List<TradeDto>> outgoing(@CurrentUser UserPrincipal principal) {
        return Map.of("trades", tradeService.outgoing(principal.getId()));
    }

    @PostMapping("/{id}/accept")
    public Map<String, TradeDto> accept(@CurrentUser UserPrincipal principal, @PathVariable UUID id) {
        return Map.of("trade", tradeService.accept(principal.getId(), id));
    }

    @PostMapping("/{id}/reject")
    public Map<String, TradeDto> reject(@CurrentUser UserPrincipal principal, @PathVariable UUID id) {
        return Map.of("trade", tradeService.reject(principal.getId(), id));
    }

    @PostMapping("/{id}/cancel")
    public Map<String, TradeDto> cancel(@CurrentUser UserPrincipal principal, @PathVariable UUID id) {
        return Map.of("trade", tradeService.cancel(principal.getId(), id));
    }
}
