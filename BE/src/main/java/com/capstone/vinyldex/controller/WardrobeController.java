package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.hotel.WardrobeService;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Negozi del quartiere: catalogo di capi, orologi e veicoli, e acquisto. */
@RestController
@RequestMapping("/api/wardrobe")
public class WardrobeController {

    private final WardrobeService wardrobeService;

    public WardrobeController(WardrobeService wardrobeService) {
        this.wardrobeService = wardrobeService;
    }

    public record BuyDto(String item) {
    }

    @GetMapping
    public Map<String, Object> mine(@CurrentUser UserPrincipal principal) {
        return wardrobeService.summary(principal.getId());
    }

    @PostMapping("/buy")
    public Map<String, Object> buy(@CurrentUser UserPrincipal principal, @RequestBody BuyDto body) {
        return wardrobeService.buy(principal.getId(), body.item());
    }
}
