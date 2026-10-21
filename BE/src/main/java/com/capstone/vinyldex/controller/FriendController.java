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
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Amici e messaggi privati dell'hotel. */
@Tag(name = Tags.AMICI, description = Tags.AMICI_INFO)
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

    @Operation(summary = "Amici e richieste di amicizia")
    @GetMapping
    public Map<String, Object> list(@CurrentUser UserPrincipal principal) {
        return friendService.list(principal.getId());
    }

    @Operation(summary = "Chiede l'amicizia a un giocatore")
    @PostMapping("/request")
    public Map<String, Object> request(@CurrentUser UserPrincipal principal, @RequestBody RequestBodyDto body) {
        return friendService.request(principal.getId(), body.username());
    }

    @Operation(summary = "Accetta una richiesta di amicizia")
    @PostMapping("/requests/{requestId}/accept")
    public Map<String, Object> accept(@CurrentUser UserPrincipal principal, @PathVariable UUID requestId) {
        return friendService.accept(principal.getId(), requestId);
    }

    /** Toglie l'amico, rifiuta la sua richiesta o annulla la propria. */
    @Operation(summary = "Toglie un amico o una richiesta",
            description = "Toglie l'amico, rifiuta la sua richiesta o annulla la propria.")
    @DeleteMapping("/{userId}")
    public Map<String, Object> remove(@CurrentUser UserPrincipal principal, @PathVariable UUID userId) {
        friendService.remove(principal.getId(), userId);
        return Map.of("removed", true);
    }

    @Operation(summary = "Messaggi privati con un amico")
    @GetMapping("/{userId}/messages")
    public List<Map<String, Object>> thread(@CurrentUser UserPrincipal principal, @PathVariable UUID userId) {
        return friendService.thread(principal.getId(), userId);
    }

    @Operation(summary = "Manda un messaggio privato")
    @PostMapping("/{userId}/messages")
    public Map<String, Object> send(@CurrentUser UserPrincipal principal, @PathVariable UUID userId, @RequestBody MessageDto body) {
        return friendService.send(principal.getId(), userId, body.text());
    }
}
