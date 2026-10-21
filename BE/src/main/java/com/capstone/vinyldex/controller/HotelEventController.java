package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.hotel.HotelEventService;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Eventi a orario dell'hotel: in corso con classifica, prossimi, ultimi vincitori. */
@Tag(name = Tags.EVENTI, description = Tags.EVENTI_INFO)
@RestController
@RequestMapping("/api/hotel/events")
public class HotelEventController {

    private final HotelEventService eventService;

    public HotelEventController(HotelEventService eventService) {
        this.eventService = eventService;
    }

    @Operation(summary = "Eventi a orario dell'hotel",
            description = "In corso con classifica, prossimi e ultimi vincitori.")
    @GetMapping
    public Map<String, Object> overview(@CurrentUser UserPrincipal principal) {
        return eventService.overview(principal.getId());
    }
}
