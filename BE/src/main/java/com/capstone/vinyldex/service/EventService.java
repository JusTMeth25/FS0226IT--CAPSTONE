package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.response.EventDto;
import com.capstone.vinyldex.entity.Event;
import com.capstone.vinyldex.repository.EventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/** Eventi visibili ai giocatori. */
@Service
public class EventService {

    private final EventRepository eventRepository;

    public EventService(EventRepository eventRepository) {
        this.eventRepository = eventRepository;
    }

    /** Eventi attivi non ancora scaduti. Un evento senza data di fine resta sempre in elenco. */
    @Transactional(readOnly = true)
    public List<EventDto> listActive() {
        Instant now = Instant.now();
        return eventRepository.findActiveWithPacksAndMissions().stream()
                .filter(event -> event.getEndsAt() == null || !event.getEndsAt().isBefore(now))
                .map(EventDto::from)
                .toList();
    }

    /** Evento in corso adesso, se ce n'e' uno: serve al calcolo del bonus drop rate. */
    @Transactional(readOnly = true)
    public List<Event> findRunning() {
        Instant now = Instant.now();
        return eventRepository.findActiveWithPacksAndMissions().stream()
                .filter(event -> event.isRunningAt(now))
                .toList();
    }
}
