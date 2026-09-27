package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.hotel.ClubService;
import com.capstone.vinyldex.hotel.CommunityService;
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

/** Club, feste, banchetti, foto e posta dell'hotel. */
@RestController
@RequestMapping("/api/hotel")
public class CommunityController {

    private final ClubService clubService;
    private final CommunityService community;

    public CommunityController(ClubService clubService, CommunityService community) {
        this.clubService = clubService;
        this.community = community;
    }

    public record ClubDto(String name, String tag, String color, String icon, String motto) {
    }

    public record PartyDto(UUID roomId, String title) {
    }

    public record StallDto(String card, int price) {
    }

    public record PhotoDto(String image, String roomName) {
    }

    /** furni: id di un mobile della borsa da regalare (facoltativo). */
    public record MailDto(UUID to, int gold, String card, String note, UUID furni) {
    }

    // ---- club

    @GetMapping("/clubs")
    public Map<String, Object> clubs(@CurrentUser UserPrincipal principal) {
        return clubService.mine(principal.getId());
    }

    @PostMapping("/clubs")
    public Map<String, Object> createClub(@CurrentUser UserPrincipal principal, @RequestBody ClubDto body) {
        return clubService.create(principal.getId(), body.name(), body.tag(), body.color(), body.icon(), body.motto());
    }

    @PostMapping("/clubs/{clubId}/join")
    public Map<String, Object> joinClub(@CurrentUser UserPrincipal principal, @PathVariable UUID clubId) {
        return clubService.join(principal.getId(), clubId);
    }

    @PostMapping("/clubs/leave")
    public Map<String, Object> leaveClub(@CurrentUser UserPrincipal principal) {
        return clubService.leave(principal.getId());
    }

    // ---- feste

    @GetMapping("/parties")
    public List<Map<String, Object>> parties() {
        return community.parties();
    }

    @PostMapping("/parties")
    public Map<String, Object> startParty(@CurrentUser UserPrincipal principal, @RequestBody PartyDto body) {
        return community.startParty(principal.getId(), body.roomId(), body.title());
    }

    @DeleteMapping("/parties/{roomId}")
    public Map<String, Object> stopParty(@CurrentUser UserPrincipal principal, @PathVariable UUID roomId) {
        community.stopParty(principal.getId(), roomId);
        return Map.of("stopped", true);
    }

    // ---- banchetti

    @GetMapping("/stalls/{itemId}")
    public Map<String, Object> stall(@PathVariable UUID itemId) {
        return community.stall(itemId);
    }

    @PostMapping("/stalls/{itemId}")
    public Map<String, Object> stallAdd(@CurrentUser UserPrincipal principal, @PathVariable UUID itemId, @RequestBody StallDto body) {
        return community.stallAdd(principal.getId(), itemId, body.card(), body.price());
    }

    @DeleteMapping("/stalls/items/{stallItemId}")
    public Map<String, Object> stallRemove(@CurrentUser UserPrincipal principal, @PathVariable UUID stallItemId) {
        return community.stallRemove(principal.getId(), stallItemId);
    }

    @PostMapping("/stalls/items/{stallItemId}/buy")
    public Map<String, Object> stallBuy(@CurrentUser UserPrincipal principal, @PathVariable UUID stallItemId) {
        return community.stallBuy(principal.getId(), stallItemId);
    }

    // ---- foto

    @GetMapping("/photos")
    public Map<String, Object> myPhotos(@CurrentUser UserPrincipal principal) {
        return Map.of("photos", community.photos(principal.getId()));
    }

    @GetMapping("/photos/users/{userId}")
    public Map<String, Object> photosOf(@PathVariable UUID userId) {
        return Map.of("photos", community.photos(userId));
    }

    @PostMapping("/photos")
    public Map<String, Object> savePhoto(@CurrentUser UserPrincipal principal, @RequestBody PhotoDto body) {
        return community.savePhoto(principal.getId(), body.image(), body.roomName());
    }

    @DeleteMapping("/photos/{photoId}")
    public Map<String, Object> deletePhoto(@CurrentUser UserPrincipal principal, @PathVariable UUID photoId) {
        community.deletePhoto(principal.getId(), photoId);
        return Map.of("photos", community.photos(principal.getId()));
    }

    // ---- posta

    @GetMapping("/mail")
    public Map<String, Object> mailbox(@CurrentUser UserPrincipal principal) {
        return community.mailbox(principal.getId());
    }

    @PostMapping("/mail")
    public Map<String, Object> sendMail(@CurrentUser UserPrincipal principal, @RequestBody MailDto body) {
        return community.sendMail(principal.getId(), body.to(), body.gold(), body.card(), body.note(), body.furni());
    }

    @PostMapping("/mail/{mailId}/claim")
    public Map<String, Object> claimMail(@CurrentUser UserPrincipal principal, @PathVariable UUID mailId) {
        return community.claimMail(principal.getId(), mailId);
    }
}
