package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.dto.request.GameRequests;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import com.capstone.vinyldex.service.PackService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = Tags.PACCHETTI, description = Tags.PACCHETTI_INFO)
@RestController
@RequestMapping("/api")
public class PackController {

    private final PackService packService;

    public PackController(PackService packService) {
        this.packService = packService;
    }

    /** Pubblico. Con un token valido aggiunge anche i pacchetti regalati e il cooldown dell'utente. */
    @Operation(summary = "Pacchetti disponibili",
            description = "Pubblico: senza token risponde comunque. Con il login aggiunge i pacchetti regalati e il cooldown dell'utente.")
    @GetMapping("/packs")
    public PackService.PackListView listPacks(@CurrentUser UserPrincipal principal) {
        return packService.listPacks(principal != null ? principal.getId() : null);
    }

    /** Pity counter: pacchetti di fila senza leggendaria, con le soglie. */
    @Operation(summary = "Pacchetti di fila senza leggendaria (pity)")
    @GetMapping("/pack-pity")
    public java.util.Map<String, Object> pity(@CurrentUser UserPrincipal principal) {
        return packService.pity(principal.getId());
    }

    /** Pacchetto del weekend: set della settimana e finestra di apertura. */
    @Operation(summary = "Pacchetto del weekend")
    @GetMapping("/pack-weekend")
    public java.util.Map<String, Object> weekend() {
        return packService.weekendInfo();
    }

    @Operation(summary = "Apre un pacchetto")
    @PostMapping("/open-pack")
    public PackService.OpenPackResult openPack(@CurrentUser UserPrincipal principal,
                                               @Valid @RequestBody GameRequests.OpenPackRequest request) {
        return packService.openPack(principal.getId(), request.packId(), request.modeOrDefault());
    }
}
