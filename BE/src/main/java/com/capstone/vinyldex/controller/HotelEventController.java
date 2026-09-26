package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.hotel.HotelEventService;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Eventi a orario dell'hotel: in corso con classifica, prossimi, ultimi vincitori. */
@RestController
@RequestMapping("/api/hotel/events")
public class HotelEventController {

    private final HotelEventService eventService;

    public HotelEventController(HotelEventService eventService) {
        this.eventService = eventService;
    }

    @GetMapping
    public Map<String, Object> overview(@CurrentUser UserPrincipal principal) {
        return eventService.overview(principal.getId());
    }
}
