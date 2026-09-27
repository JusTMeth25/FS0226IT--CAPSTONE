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

    public record SellDto(String item, int price) {
    }

    /** Mercato dell'usato: annunci dei giocatori (di un negozio, se indicato). */
    @GetMapping("/market")
    public Map<String, Object> market(@CurrentUser UserPrincipal principal,
                                      @org.springframework.web.bind.annotation.RequestParam(required = false) String shop) {
        return wardrobeService.market(principal.getId(), shop);
    }

    @PostMapping("/market")
    public Map<String, Object> sell(@CurrentUser UserPrincipal principal, @RequestBody SellDto body) {
        return wardrobeService.sell(principal.getId(), body.item(), body.price());
    }

    @PostMapping("/market/{id}/buy")
    public Map<String, Object> buyListing(@CurrentUser UserPrincipal principal, @org.springframework.web.bind.annotation.PathVariable java.util.UUID id) {
        return wardrobeService.buyListing(principal.getId(), id);
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/market/{id}")
    public Map<String, Object> withdraw(@CurrentUser UserPrincipal principal, @org.springframework.web.bind.annotation.PathVariable java.util.UUID id) {
        return wardrobeService.withdraw(principal.getId(), id);
    }

    /** Auto comprata da esporre in casa (pedana girevole nella borsa dei mobili). */
    @PostMapping("/showcase")
    public Map<String, Object> showcase(@CurrentUser UserPrincipal principal, @RequestBody BuyDto body) {
        return Map.of("item", wardrobeService.showcase(principal.getId(), body.item()));
    }
}
