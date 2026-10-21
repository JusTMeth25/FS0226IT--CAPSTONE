package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.hotel.AuctionService;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Asta dell'hotel: la carta in vendita e le offerte. */
@Tag(name = Tags.HOTEL, description = Tags.HOTEL_INFO)
@RestController
@RequestMapping("/api/hotel/auction")
public class AuctionController {

    private final AuctionService auctionService;

    public AuctionController(AuctionService auctionService) {
        this.auctionService = auctionService;
    }

    public record BidDto(int amount) {
    }

    @Operation(summary = "Asta dell'hotel: carta in vendita e offerte")
    @GetMapping
    public Map<String, Object> overview() {
        return auctionService.overview();
    }

    @Operation(summary = "Fa un'offerta all'asta")
    @PostMapping("/bid")
    public Map<String, Object> bid(@CurrentUser UserPrincipal principal, @RequestBody BidDto body) {
        return auctionService.bid(principal.getId(), body.amount());
    }
}
