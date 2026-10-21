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
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Negozi del quartiere: catalogo di capi, orologi e veicoli, e acquisto. */
@Tag(name = Tags.GUARDAROBA, description = Tags.GUARDAROBA_INFO)
@RestController
@RequestMapping("/api/wardrobe")
public class WardrobeController {

    private final WardrobeService wardrobeService;

    public WardrobeController(WardrobeService wardrobeService) {
        this.wardrobeService = wardrobeService;
    }

    public record BuyDto(String item) {
    }

    @Operation(summary = "Catalogo e oggetti posseduti")
    @GetMapping
    public Map<String, Object> mine(@CurrentUser UserPrincipal principal) {
        return wardrobeService.summary(principal.getId());
    }

    @Operation(summary = "Compra un oggetto")
    @PostMapping("/buy")
    public Map<String, Object> buy(@CurrentUser UserPrincipal principal, @RequestBody BuyDto body) {
        return wardrobeService.buy(principal.getId(), body.item());
    }

    public record SellDto(String item, int price) {
    }

    /** Mercato dell'usato: annunci dei giocatori (di un negozio, se indicato). */
    @Operation(summary = "Mercato dell'usato")
    @GetMapping("/market")
    public Map<String, Object> market(@CurrentUser UserPrincipal principal,
                                      @org.springframework.web.bind.annotation.RequestParam(required = false) String shop) {
        return wardrobeService.market(principal.getId(), shop);
    }

    @Operation(summary = "Mette in vendita un oggetto")
    @PostMapping("/market")
    public Map<String, Object> sell(@CurrentUser UserPrincipal principal, @RequestBody SellDto body) {
        return wardrobeService.sell(principal.getId(), body.item(), body.price());
    }

    @Operation(summary = "Compra un oggetto dell'usato")
    @PostMapping("/market/{id}/buy")
    public Map<String, Object> buyListing(@CurrentUser UserPrincipal principal, @org.springframework.web.bind.annotation.PathVariable java.util.UUID id) {
        return wardrobeService.buyListing(principal.getId(), id);
    }

    @Operation(summary = "Ritira un proprio annuncio")
    @org.springframework.web.bind.annotation.DeleteMapping("/market/{id}")
    public Map<String, Object> withdraw(@CurrentUser UserPrincipal principal, @org.springframework.web.bind.annotation.PathVariable java.util.UUID id) {
        return wardrobeService.withdraw(principal.getId(), id);
    }

    /** Auto comprata da esporre in casa (pedana girevole nella borsa dei mobili). */
    @Operation(summary = "Espone in casa un'auto comprata")
    @PostMapping("/showcase")
    public Map<String, Object> showcase(@CurrentUser UserPrincipal principal, @RequestBody BuyDto body) {
        return Map.of("item", wardrobeService.showcase(principal.getId(), body.item()));
    }
}
