package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.hotel.GalleryService;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
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

/** Mostra delle collezioni: esposizione della settimana e voti. */
@Tag(name = Tags.HOTEL, description = Tags.HOTEL_INFO)
@RestController
@RequestMapping("/api/hotel/gallery")
public class GalleryController {

    private final GalleryService galleryService;

    public GalleryController(GalleryService galleryService) {
        this.galleryService = galleryService;
    }

    public record ExhibitDto(List<String> cards) {
    }

    @Operation(summary = "Mostra delle collezioni della settimana")
    @GetMapping
    public Map<String, Object> overview(@CurrentUser UserPrincipal principal) {
        return galleryService.overview(principal.getId());
    }

    @Operation(summary = "Sceglie le carte da esporre")
    @PutMapping
    public Map<String, Object> exhibit(@CurrentUser UserPrincipal principal, @RequestBody ExhibitDto body) {
        return galleryService.exhibit(principal.getId(), body.cards());
    }

    @Operation(summary = "Vota l'esposizione di un giocatore")
    @PostMapping("/{userId}/vote")
    public Map<String, Object> vote(@CurrentUser UserPrincipal principal, @PathVariable UUID userId) {
        return galleryService.vote(principal.getId(), userId);
    }
}
