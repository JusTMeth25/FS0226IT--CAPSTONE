package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.CollectionExtrasService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Lista dei desideri, squadre salvate, confronto fra collezioni e statistiche. */
@Tag(name = Tags.COLLEZIONE, description = Tags.COLLEZIONE_INFO)
@RestController
@RequestMapping("/api")
public class CollectionExtrasController {

    private final CollectionExtrasService service;

    public CollectionExtrasController(CollectionExtrasService service) {
        this.service = service;
    }

    public record TeamDto(String name, List<String> cards) {
    }

    @Operation(summary = "Lista dei desideri")
    @GetMapping("/wishlist")
    public Map<String, Object> wishlist(@CurrentUser UserPrincipal principal) {
        return service.wishlist(principal.getId());
    }

    @Operation(summary = "Codici delle carte nella lista dei desideri")
    @GetMapping("/wishlist/codes")
    public List<String> wishCodes(@CurrentUser UserPrincipal principal) {
        return service.wishCodes(principal.getId());
    }

    @Operation(summary = "Aggiunge una carta alla lista dei desideri")
    @PutMapping("/wishlist/{code}")
    public Map<String, Object> addWish(@CurrentUser UserPrincipal principal, @PathVariable String code) {
        return service.addWish(principal.getId(), code);
    }

    @Operation(summary = "Toglie una carta dalla lista dei desideri")
    @DeleteMapping("/wishlist/{code}")
    public Map<String, Object> removeWish(@CurrentUser UserPrincipal principal, @PathVariable String code) {
        return service.removeWish(principal.getId(), code);
    }

    @Operation(summary = "Squadre salvate")
    @GetMapping("/teams")
    public List<Map<String, Object>> teams(@CurrentUser UserPrincipal principal) {
        return service.teams(principal.getId());
    }

    @Operation(summary = "Salva una squadra")
    @PostMapping("/teams")
    public List<Map<String, Object>> saveTeam(@CurrentUser UserPrincipal principal, @RequestBody TeamDto body) {
        return service.saveTeam(principal.getId(), body.name(), body.cards());
    }

    @Operation(summary = "Elimina una squadra")
    @DeleteMapping("/teams/{id}")
    public List<Map<String, Object>> deleteTeam(@CurrentUser UserPrincipal principal, @PathVariable UUID id) {
        return service.deleteTeam(principal.getId(), id);
    }

    /** Carte di un altro giocatore da chiedere in uno scambio (username o id). */
    @Operation(summary = "Carte di un altro giocatore da chiedere in uno scambio",
            description = "handle: username o id del giocatore.")
    @GetMapping("/collection/of/{handle}")
    public Map<String, Object> tradable(@CurrentUser UserPrincipal principal, @PathVariable String handle) {
        return service.tradableCards(principal.getId(), handle);
    }

    @Operation(summary = "Confronta la propria collezione con quella di un altro giocatore")
    @GetMapping("/collection/compare/{userId}")
    public Map<String, Object> compare(@CurrentUser UserPrincipal principal, @PathVariable UUID userId) {
        return service.compare(principal.getId(), userId);
    }

    @Operation(summary = "Statistiche della collezione")
    @GetMapping("/collection/stats")
    public Map<String, Object> stats(@CurrentUser UserPrincipal principal) {
        return service.stats(principal.getId());
    }
}
