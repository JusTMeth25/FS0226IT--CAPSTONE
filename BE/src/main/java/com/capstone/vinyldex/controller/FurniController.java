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
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Negozio e inventario dei mobili dell'hotel. Posizionarli passa dal WebSocket, cosi' tutti
 * i presenti nella stanza li vedono comparire subito.
 */
@Tag(name = Tags.HOTEL, description = Tags.HOTEL_INFO)
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
    @Operation(summary = "Catalogo dei mobili")
    @GetMapping("/catalog")
    public Map<String, List<FurniCatalog.FurniDef>> catalog() {
        return Map.of("furni", FurniCatalog.all());
    }

    @Operation(summary = "Mobili nella borsa")
    @GetMapping("/inventory")
    public Map<String, List<RoomItemView>> inventory(@CurrentUser UserPrincipal principal) {
        return Map.of("items", furniService.inventory(principal.getId()));
    }

    @Operation(summary = "Compra un mobile",
            description = "Posizionarlo in una stanza passa dal WebSocket /ws/hotel.")
    @PostMapping("/buy")
    public Map<String, RoomItemView> buy(@CurrentUser UserPrincipal principal, @Valid @RequestBody BuyRequest request) {
        return Map.of("item", furniService.buy(principal.getId(), request.type()));
    }
}
