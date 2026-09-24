package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.hotel.FurniCatalog;
import com.capstone.vinyldex.hotel.FurniService;
import com.capstone.vinyldex.hotel.RoomItemView;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Negozio e inventario dei mobili dell'hotel. Posizionarli passa dal WebSocket, cosi' tutti
 * i presenti nella stanza li vedono comparire subito.
 */
@RestController
@RequestMapping("/api/furni")
public class FurniController {

    public record BuyRequest(@NotBlank(message = "furni_not_for_sale") String type) {
    }

    private final FurniService furniService;

    public FurniController(FurniService furniService) {
        this.furniService = furniService;
    }

    /** Catalogo completo: il frontend ne ricava prezzi, ingombri e regole di ogni mobile. */
    @GetMapping("/catalog")
    public Map<String, List<FurniCatalog.FurniDef>> catalog() {
        return Map.of("furni", FurniCatalog.all());
    }

    @GetMapping("/inventory")
    public Map<String, List<RoomItemView>> inventory(@CurrentUser UserPrincipal principal) {
        return Map.of("items", furniService.inventory(principal.getId()));
    }

    @PostMapping("/buy")
    public Map<String, RoomItemView> buy(@CurrentUser UserPrincipal principal, @Valid @RequestBody BuyRequest request) {
        return Map.of("item", furniService.buy(principal.getId(), request.type()));
    }
}
