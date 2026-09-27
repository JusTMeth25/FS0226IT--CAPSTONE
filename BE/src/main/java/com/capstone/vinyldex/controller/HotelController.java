package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.hotel.HotelSocialService;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
    private final com.capstone.vinyldex.hotel.NpcQuestService questService;

    public HotelController(HotelSocialService socialService, UserRepository userRepository,
                           com.capstone.vinyldex.hotel.NpcQuestService questService) {
        this.socialService = socialService;
        this.userRepository = userRepository;
        this.questService = questService;
    }

    /** Incarichi degli NPC di oggi, con le carte del giocatore che vanno bene. */
    @GetMapping("/quests")
    public Map<String, Object> quests(@CurrentUser UserPrincipal principal) {
        return questService.quests(principal.getId());
    }

    /** Consegna una carta per un incarico: { "card": "codice" }. */
    @PostMapping("/quests/{index}")
    public Map<String, Object> deliver(@CurrentUser UserPrincipal principal, @PathVariable int index,
                                       @RequestBody Map<String, String> body) {
        return questService.deliver(principal.getId(), index, body == null ? null : body.get("card"));
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

    /** Distintivo da mostrare accanto al nome nell'hotel: { "code": "set-..." }, null per toglierlo. */
    @PutMapping("/badge")
    public Map<String, Object> wearBadge(@CurrentUser UserPrincipal principal, @RequestBody Map<String, String> body) {
        return socialService.wear(principal.getId(), body == null ? null : body.get("code"));
    }

    @GetMapping("/profile/{userId}")
    public Map<String, Object> profile(@CurrentUser UserPrincipal principal, @PathVariable UUID userId) {
        return socialService.profile(principal.getId(), userId);
    }
}
