package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.hotel.FriendService;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Amici e messaggi privati dell'hotel. */
@RestController
@RequestMapping("/api/friends")
public class FriendController {

    private final FriendService friendService;

    public FriendController(FriendService friendService) {
        this.friendService = friendService;
    }

    public record RequestBodyDto(String username) {
    }

    public record MessageDto(String text) {
    }

    @GetMapping
    public Map<String, Object> list(@CurrentUser UserPrincipal principal) {
        return friendService.list(principal.getId());
    }

    @PostMapping("/request")
    public Map<String, Object> request(@CurrentUser UserPrincipal principal, @RequestBody RequestBodyDto body) {
        return friendService.request(principal.getId(), body.username());
    }

    @PostMapping("/requests/{requestId}/accept")
    public Map<String, Object> accept(@CurrentUser UserPrincipal principal, @PathVariable UUID requestId) {
        return friendService.accept(principal.getId(), requestId);
    }

    /** Toglie l'amico, rifiuta la sua richiesta o annulla la propria. */
    @DeleteMapping("/{userId}")
    public Map<String, Object> remove(@CurrentUser UserPrincipal principal, @PathVariable UUID userId) {
        friendService.remove(principal.getId(), userId);
        return Map.of("removed", true);
    }

    @GetMapping("/{userId}/messages")
    public List<Map<String, Object>> thread(@CurrentUser UserPrincipal principal, @PathVariable UUID userId) {
        return friendService.thread(principal.getId(), userId);
    }

    @PostMapping("/{userId}/messages")
    public Map<String, Object> send(@CurrentUser UserPrincipal principal, @PathVariable UUID userId, @RequestBody MessageDto body) {
        return friendService.send(principal.getId(), userId, body.text());
    }
}
