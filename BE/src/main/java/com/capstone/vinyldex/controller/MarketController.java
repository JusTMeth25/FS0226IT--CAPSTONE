package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.dto.request.GameRequests;
import com.capstone.vinyldex.dto.response.MarketListingDto;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.MarketService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/market")
public class MarketController {

    private final MarketService marketService;

    public MarketController(MarketService marketService) {
        this.marketService = marketService;
    }

    @GetMapping("/listings")
    public Map<String, List<MarketListingDto>> listings(@RequestParam(required = false) String rarity,
                                                        @RequestParam(required = false) String cardId) {
        return Map.of("listings", marketService.listActive(rarity, cardId));
    }

    @PostMapping("/list")
    public ResponseEntity<Map<String, MarketListingDto>> createListing(
            @CurrentUser UserPrincipal principal,
            @Valid @RequestBody GameRequests.MarketListRequest request) {

        MarketListingDto listing = marketService.createListing(
                principal.getId(), request.cardId(), request.quantity(), request.pricePerUnit());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("listing", listing));
    }

    @PostMapping("/buy")
    public MarketService.BuyResult buy(@CurrentUser UserPrincipal principal,
                                       @Valid @RequestBody GameRequests.MarketBuyRequest request) {
        return marketService.buy(principal.getId(), request.listingId(), request.quantityOrOne());
    }

    @DeleteMapping("/listings/{id}")
    public Map<String, Boolean> cancel(@CurrentUser UserPrincipal principal, @PathVariable UUID id) {
        marketService.cancelListing(principal.getId(), id);
        return Map.of("ok", true);
    }
}
