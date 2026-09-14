package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.dto.request.AdminRequests;
import com.capstone.vinyldex.dto.response.AdminDtos;
import com.capstone.vinyldex.dto.response.PublicUserDto;
import com.capstone.vinyldex.importer.ImportResult;
import com.capstone.vinyldex.importer.ImportService;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.AdminService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Pannello di amministrazione.
 *
 * L'accesso e' gia' ristretto in SecurityConfig; @PreAuthorize qui e' una seconda barriera,
 * cosi' un futuro cambio alle regole di percorso non apre per sbaglio queste rotte.
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;
    private final ImportService importService;

    public AdminController(AdminService adminService, ImportService importService) {
        this.adminService = adminService;
        this.importService = importService;
    }

    // ------------------------------------------------------------------ utenti

    @GetMapping("/users")
    public Map<String, List<PublicUserDto>> listUsers() {
        return Map.of("users", adminService.listUsers());
    }

    @PostMapping("/users/{id}/ban")
    public Map<String, PublicUserDto> ban(@PathVariable UUID id, @RequestBody(required = false) AdminRequests.BanRequest request) {
        String reason = request == null ? null : request.reason();
        return Map.of("user", adminService.setBanned(id, true, reason));
    }

    @PostMapping("/users/{id}/unban")
    public Map<String, PublicUserDto> unban(@PathVariable UUID id) {
        return Map.of("user", adminService.setBanned(id, false, null));
    }

    @PatchMapping("/users/{id}/gold")
    public Map<String, PublicUserDto> setGold(@CurrentUser UserPrincipal principal,
                                              @PathVariable UUID id,
                                              @Valid @RequestBody AdminRequests.GoldRequest request) {
        return Map.of("user", adminService.setGold(id, request.gold(), principal.getUsername()));
    }

    // ------------------------------------------------------------------- carte

    @GetMapping("/cards")
    public Map<String, List<AdminDtos.AdminCardDto>> listCards() {
        return Map.of("cards", adminService.listCards());
    }

    @PostMapping("/cards")
    public ResponseEntity<Map<String, AdminDtos.AdminCardDto>> createCard(
            @Valid @RequestBody AdminRequests.CardCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("card", adminService.createCard(request)));
    }

    @PatchMapping("/cards/{id}")
    public Map<String, AdminDtos.AdminCardDto> updateCard(@PathVariable UUID id,
                                                          @RequestBody AdminRequests.CardUpdateRequest request) {
        return Map.of("card", adminService.updateCard(id, request));
    }

    // -------------------------------------------------------------- pacchetti

    @GetMapping("/packs")
    public Map<String, List<AdminDtos.AdminPackDto>> listPacks() {
        return Map.of("packs", adminService.listPacks());
    }

    @PostMapping("/packs")
    public ResponseEntity<Map<String, AdminDtos.AdminPackDto>> createPack(
            @Valid @RequestBody AdminRequests.PackCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("pack", adminService.createPack(request)));
    }

    @PatchMapping("/packs/{id}")
    public Map<String, AdminDtos.AdminPackDto> updatePack(@PathVariable UUID id,
                                                          @RequestBody AdminRequests.PackUpdateRequest request) {
        return Map.of("pack", adminService.updatePack(id, request));
    }

    @PutMapping("/packs/{id}/drop-rates")
    public Map<String, Boolean> replaceDropRates(@PathVariable UUID id,
                                                 @RequestBody AdminRequests.DropRatesRequest request) {
        adminService.replaceDropRates(id, request.dropRates());
        return Map.of("ok", true);
    }

    @PutMapping("/packs/{id}/guarantees")
    public Map<String, Boolean> replaceGuarantees(@PathVariable UUID id,
                                                  @RequestBody AdminRequests.GuaranteesRequest request) {
        adminService.replaceGuarantees(id, request.guarantees());
        return Map.of("ok", true);
    }

    // ------------------------------------------------------ import carte esterne

    /**
     * Una sola rotta per tutte le fonti: aggiungere un importer non richiede di toccare il
     * controller. I percorsi restano quelli del backend Node (/import/pokemon, /import/scryfall...).
     */
    @PostMapping("/import/{source}")
    public ImportResult importCards(@PathVariable String source,
                                    @RequestBody(required = false) AdminRequests.ImportRequest request) {
        AdminRequests.ImportRequest safeRequest = request != null
                ? request
                : new AdminRequests.ImportRequest(null, null, null, null, null, null);
        return importService.importFrom(source, safeRequest);
    }

    @GetMapping("/import/sources")
    public Map<String, Set<String>> importSources() {
        return Map.of("sources", importService.availableSources());
    }

    // ---------------------------------------------------------------- missioni

    @GetMapping("/missions")
    public Map<String, List<AdminDtos.AdminMissionDto>> listMissions() {
        return Map.of("missions", adminService.listMissions());
    }

    @PostMapping("/missions")
    public ResponseEntity<Map<String, AdminDtos.AdminMissionDto>> createMission(
            @Valid @RequestBody AdminRequests.MissionCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("mission", adminService.createMission(request)));
    }

    @PatchMapping("/missions/{id}")
    public Map<String, AdminDtos.AdminMissionDto> updateMission(@PathVariable UUID id,
                                                                @RequestBody AdminRequests.MissionUpdateRequest request) {
        return Map.of("mission", adminService.updateMission(id, request));
    }

    // ------------------------------------------------------------------ eventi

    @GetMapping("/events")
    public Map<String, List<AdminDtos.AdminEventDto>> listEvents() {
        return Map.of("events", adminService.listEvents());
    }

    @PostMapping("/events")
    public ResponseEntity<Map<String, AdminDtos.AdminEventDto>> createEvent(
            @Valid @RequestBody AdminRequests.EventCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("event", adminService.createEvent(request)));
    }

    @PatchMapping("/events/{id}")
    public Map<String, AdminDtos.AdminEventDto> updateEvent(@PathVariable UUID id,
                                                            @RequestBody AdminRequests.EventUpdateRequest request) {
        return Map.of("event", adminService.updateEvent(id, request));
    }

    // --------------------------------------------------------------------- log

    @GetMapping("/logs/pack-openings")
    public Map<String, List<AdminDtos.PackOpeningLogDto>> packOpeningLogs() {
        return Map.of("logs", adminService.listPackOpeningLogs());
    }

    @GetMapping("/market/listings")
    public Map<String, List<AdminDtos.AdminListingDto>> allListings() {
        return Map.of("listings", adminService.listAllListings());
    }

    @GetMapping("/trades")
    public Map<String, List<AdminDtos.AdminTradeDto>> allTrades() {
        return Map.of("trades", adminService.listAllTrades());
    }
}
