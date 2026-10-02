package com.capstone.vinyldex.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.json.JsonMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Le immagini delle carte hanno un contatore a parte e non bloccano le altre richieste. */
class RateLimitFilterTest {

    private final RateLimitFilter filter = new RateLimitFilter(JsonMapper.builder().build(), true, 5, 50, 60);

    private int call(String path) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        request.setRemoteAddr("10.0.0.1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response.getStatus();
    }

    @Test
    @DisplayName("Sfogliare il raccoglitore (tante immagini) non blocca la pagina della carta")
    void imagesDoNotExhaustApiLimit() throws Exception {
        for (int i = 0; i < 40; i++) assertEquals(200, call("/api/cards/scryfall-" + i + "/image"));
        assertEquals(200, call("/api/cards/nba-x/nba-card.svg"));
        assertEquals(200, call("/api/cards/scryfall-1"), "il limite delle API e' ancora tutto disponibile");
    }

    @Test
    @DisplayName("Oltre il limite si risponde 429, per le API e per le immagini separatamente")
    void limitsStillApply() throws Exception {
        for (int i = 0; i < 5; i++) assertEquals(200, call("/api/packs"));
        assertEquals(429, call("/api/packs"));
        assertEquals(200, call("/api/cards/x/image"), "le immagini hanno il loro contatore");
        for (int i = 0; i < 49; i++) call("/api/cards/x/image");
        assertEquals(429, call("/api/cards/x/image"));
    }
}
