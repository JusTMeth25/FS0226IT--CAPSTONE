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

/** Asta dell'hotel: la carta in vendita e le offerte. */
@RestController
@RequestMapping("/api/hotel/auction")
public class AuctionController {

    private final AuctionService auctionService;

    public AuctionController(AuctionService auctionService) {
        this.auctionService = auctionService;
    }

    public record BidDto(int amount) {
    }

    @GetMapping
    public Map<String, Object> overview() {
        return auctionService.overview();
    }

    @PostMapping("/bid")
    public Map<String, Object> bid(@CurrentUser UserPrincipal principal, @RequestBody BidDto body) {
        return auctionService.bid(principal.getId(), body.amount());
    }
}
