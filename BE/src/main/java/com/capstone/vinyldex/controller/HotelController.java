package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.hotel.HotelSocialService;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/** Profili dei giocatori come li mostra la scheda dell'hotel. */
@RestController
@RequestMapping("/api/hotel")
public class HotelController {

    private final HotelSocialService socialService;
    private final UserRepository userRepository;

    public HotelController(HotelSocialService socialService, UserRepository userRepository) {
        this.socialService = socialService;
        this.userRepository = userRepository;
    }

    /** Il tutorial dell'hotel e' gia' stato visto? La guida si presenta solo alla prima visita. */
    @GetMapping("/tutorial")
    public Map<String, Object> tutorial(@CurrentUser UserPrincipal principal) {
        boolean done = userRepository.findById(principal.getId()).map(u -> u.isHotelTutorialDone()).orElse(true);
        return Map.of("done", done);
    }

    /** Tutorial finito (o saltato): non si ripresenta piu'. */
    @PostMapping("/tutorial")
    @Transactional
    public Map<String, Object> tutorialDone(@CurrentUser UserPrincipal principal) {
        userRepository.findById(principal.getId()).ifPresent(u -> u.setHotelTutorialDone(true));
        return Map.of("done", true);
    }

    @GetMapping("/profile/{userId}")
    public Map<String, Object> profile(@CurrentUser UserPrincipal principal, @PathVariable UUID userId) {
        return socialService.profile(principal.getId(), userId);
    }
}
