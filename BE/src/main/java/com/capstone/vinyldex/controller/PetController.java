package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.hotel.PetService;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Animale da compagnia dell'hotel: catalogo, adozione, cibo. */
@Tag(name = Tags.HOTEL, description = Tags.HOTEL_INFO)
@RestController
@RequestMapping("/api/pets")
public class PetController {

    private final PetService petService;

    public PetController(PetService petService) {
        this.petService = petService;
    }

    public record AdoptDto(String type, String name) {
    }

    @Operation(summary = "Il proprio animale e il catalogo")
    @GetMapping
    public Map<String, Object> mine(@CurrentUser UserPrincipal principal) {
        return petService.summary(principal.getId());
    }

    @Operation(summary = "Adotta un animale")
    @PostMapping("/adopt")
    public Map<String, Object> adopt(@CurrentUser UserPrincipal principal, @RequestBody AdoptDto body) {
        return petService.adopt(principal.getId(), body.type(), body.name());
    }

    @Operation(summary = "Dà da mangiare all'animale")
    @PostMapping("/feed")
    public Map<String, Object> feed(@CurrentUser UserPrincipal principal) {
        return petService.feed(principal.getId());
    }

    @Operation(summary = "Libera l'animale")
    @DeleteMapping
    public Map<String, Object> release(@CurrentUser UserPrincipal principal) {
        return petService.release(principal.getId());
    }
}
