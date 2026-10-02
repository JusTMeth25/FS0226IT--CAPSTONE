package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.dto.response.CardDto;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.CollectionService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class CollectionController {

    private final CollectionService collectionService;

    public CollectionController(CollectionService collectionService) {
        this.collectionService = collectionService;
    }

    @GetMapping("/collection")
    public CollectionService.CollectionView getCollection(
            @CurrentUser UserPrincipal principal,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String rarity,
            @RequestParam(required = false) String set,
            @RequestParam(required = false) String source,
            @RequestParam(required = false) String owned) {

        return collectionService.getCollection(principal.getId(), search, rarity, set, source, owned);
    }

    /** id e' il code pubblico della carta, non lo UUID. */
    /** Raccoglitore a pagine: un gioco (source) o un set (set), dalle carte offset, al massimo limit. */
    @GetMapping("/collection/binder")
    public CollectionService.BinderPage binder(@CurrentUser UserPrincipal principal,
                                               @org.springframework.web.bind.annotation.RequestParam(required = false) String source,
                                               @org.springframework.web.bind.annotation.RequestParam(required = false) String set,
                                               @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int offset,
                                               @org.springframework.web.bind.annotation.RequestParam(defaultValue = "90") int limit) {
        return collectionService.binder(principal.getId(), source, set, offset, limit);
    }

    @GetMapping("/cards/{id}")
    public Map<String, CardDto> getCard(@PathVariable String id) {
        return Map.of("card", collectionService.getCardByCode(id));
    }

    @PostMapping("/collection/{cardId}/favorite")
    public Map<String, Boolean> toggleFavorite(@CurrentUser UserPrincipal principal, @PathVariable String cardId) {
        return Map.of("isFavorite", collectionService.toggleFavorite(principal.getId(), cardId));
    }
}
