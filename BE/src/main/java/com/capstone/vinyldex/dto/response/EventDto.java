package com.capstone.vinyldex.dto.response;

import com.capstone.vinyldex.entity.Event;
import com.capstone.vinyldex.entity.Mission;
import com.capstone.vinyldex.entity.Pack;

import java.time.Instant;
import java.util.List;

/**
 * Evento attivo. bonusDropRate e' il bonus netto (0.5 = +50%), non il moltiplicatore:
 * un evento senza bonus espone 0 invece di 1.
 */
public record EventDto(
        String id,
        String name,
        String description,
        Instant startsAt,
        Instant endsAt,
        double bonusDropRate,
        List<String> packs,
        List<String> missions
) {

    public static EventDto from(Event event) {
        return new EventDto(
                event.getCode(),
                event.getName(),
                event.getDescription(),
                event.getStartsAt(),
                event.getEndsAt(),
                event.getBonusDropRateMultiplier() > 1 ? event.getBonusDropRateMultiplier() - 1 : 0,
                event.getPacks().stream().map(Pack::getCode).toList(),
                event.getMissions().stream().map(Mission::getCode).toList());
    }
}
