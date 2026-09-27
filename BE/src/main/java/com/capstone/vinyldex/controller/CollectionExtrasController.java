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

/** Lista dei desideri, squadre salvate, confronto fra collezioni e statistiche. */
@RestController
@RequestMapping("/api")
public class CollectionExtrasController {

    private final CollectionExtrasService service;

    public CollectionExtrasController(CollectionExtrasService service) {
        this.service = service;
    }

    public record TeamDto(String name, List<String> cards) {
    }

    @GetMapping("/wishlist")
    public Map<String, Object> wishlist(@CurrentUser UserPrincipal principal) {
        return service.wishlist(principal.getId());
    }

    @GetMapping("/wishlist/codes")
    public List<String> wishCodes(@CurrentUser UserPrincipal principal) {
        return service.wishCodes(principal.getId());
    }

    @PutMapping("/wishlist/{code}")
    public Map<String, Object> addWish(@CurrentUser UserPrincipal principal, @PathVariable String code) {
        return service.addWish(principal.getId(), code);
    }

    @DeleteMapping("/wishlist/{code}")
    public Map<String, Object> removeWish(@CurrentUser UserPrincipal principal, @PathVariable String code) {
        return service.removeWish(principal.getId(), code);
    }

    @GetMapping("/teams")
    public List<Map<String, Object>> teams(@CurrentUser UserPrincipal principal) {
        return service.teams(principal.getId());
    }

    @PostMapping("/teams")
    public List<Map<String, Object>> saveTeam(@CurrentUser UserPrincipal principal, @RequestBody TeamDto body) {
        return service.saveTeam(principal.getId(), body.name(), body.cards());
    }

    @DeleteMapping("/teams/{id}")
    public List<Map<String, Object>> deleteTeam(@CurrentUser UserPrincipal principal, @PathVariable UUID id) {
        return service.deleteTeam(principal.getId(), id);
    }

    @GetMapping("/collection/compare/{userId}")
    public Map<String, Object> compare(@CurrentUser UserPrincipal principal, @PathVariable UUID userId) {
        return service.compare(principal.getId(), userId);
    }

    @GetMapping("/collection/stats")
    public Map<String, Object> stats(@CurrentUser UserPrincipal principal) {
        return service.stats(principal.getId());
    }
}
