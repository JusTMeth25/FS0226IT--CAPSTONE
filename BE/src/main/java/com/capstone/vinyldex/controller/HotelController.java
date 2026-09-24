package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.hotel.HotelSocialService;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/** Profili dei giocatori come li mostra la scheda dell'hotel. */
@RestController
@RequestMapping("/api/hotel")
public class HotelController {

    private final HotelSocialService socialService;

    public HotelController(HotelSocialService socialService) {
        this.socialService = socialService;
    }

    @GetMapping("/profile/{userId}")
    public Map<String, Object> profile(@CurrentUser UserPrincipal principal, @PathVariable UUID userId) {
        return socialService.profile(principal.getId(), userId);
    }
}
