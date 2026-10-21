package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.hotel.HotelSocialService;
import com.capstone.vinyldex.hotel.RoomData;
import com.capstone.vinyldex.hotel.RoomService;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Stanze dell'hotel. Movimento, chat e mobili passano dal WebSocket; qui navigatore e impostazioni. */
@Tag(name = Tags.HOTEL, description = Tags.HOTEL_INFO)
@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    public record SettingsRequest(String name, String description, String doorMode, Integer maxUsers,
                                  String floorStyle, String wallStyle) {
    }

    private final RoomService roomService;
    private final HotelSocialService socialService;
    private final com.capstone.vinyldex.hotel.CommunityService community;

    public RoomController(RoomService roomService, HotelSocialService socialService,
                          com.capstone.vinyldex.hotel.CommunityService community) {
        this.roomService = roomService;
        this.community = community;
        this.socialService = socialService;
    }

    @Operation(summary = "Navigatore delle stanze",
            description = "In cima le feste in corso.")
    @GetMapping("/navigator")
    public Map<String, Object> navigator() {
        // In cima le feste in corso.
        Map<String, Object> result = new java.util.LinkedHashMap<>(roomService.navigator());
        result.put("parties", community.parties());
        return result;
    }

    /** La propria stanza, creata alla prima visita. */
    @Operation(summary = "La propria stanza, creata alla prima visita")
    @PostMapping("/mine")
    public Map<String, RoomData> mine(@CurrentUser UserPrincipal principal) {
        return Map.of("room", roomService.ensureMyRoom(principal.getId()));
    }

    /** "Mi piace" della stanza: quanti in tutto e se c'e' anche quello di chi chiede. */
    @Operation(summary = "\"Mi piace\" di una stanza")
    @GetMapping("/{id}/likes")
    public Map<String, Object> likes(@CurrentUser UserPrincipal principal, @PathVariable UUID id) {
        return Map.of("likes", socialService.likesByRoom().getOrDefault(id, 0L),
                "liked", socialService.hasLiked(principal.getId(), id));
    }

    @Operation(summary = "Mette o toglie il \"mi piace\" a una stanza")
    @PostMapping("/{id}/like")
    public Map<String, Object> toggleLike(@CurrentUser UserPrincipal principal, @PathVariable UUID id) {
        return socialService.toggleLike(principal.getId(), id);
    }

    @Operation(summary = "Modifica le impostazioni della propria stanza")
    @PatchMapping("/{id}")
    public Map<String, RoomData> updateSettings(@CurrentUser UserPrincipal principal, @PathVariable UUID id,
                                                @RequestBody SettingsRequest request) {
        return Map.of("room", roomService.updateSettings(principal.getId(), id, request.name(), request.description(),
                request.doorMode(), request.maxUsers(), request.floorStyle(), request.wallStyle()));
    }
}
