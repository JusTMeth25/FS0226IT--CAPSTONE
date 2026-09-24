package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class OpenRouterNpcMindTest {

    private static final String MODELS = "nvidia/nemotron-3-super-120b-a12b:free,poolside/laguna-s-2.1:free,google/gemma-4-31b-it:free";

    private final JsonMapper mapper = JsonMapper.builder().build();

    private static NpcMind.Prompt prompt(UUID user, NpcRoster.Role role, List<String> menu) {
        return new NpcMind.Prompt(UUID.randomUUID(), user, "Vinnie", role, "Neon Bar", "Cocktail al neon.", menu,
                "anna", null, List.of("bruno"), true, List.of(), "ciao Vinnie, cosa mi consigli?");
    }

    @SuppressWarnings("unchecked")
    private OpenRouterNpcMind mind(int dailyLimit, int status, String body) throws Exception {
        HttpClient http = mock(HttpClient.class);
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(body);
        when(http.send(any(), any(HttpResponse.BodyHandler.class))).thenReturn((HttpResponse) response);
        return new OpenRouterNpcMind(mapper, () -> "Fatti del gioco.", "sk-test", MODELS, dailyLimit, 20, 99, 5_000,
                Clock.systemDefaultZone(), http);
    }

    private static String completion(String content) {
        return "{\"choices\":[{\"message\":{\"content\":" + JsonMapper.builder().build().writeValueAsString(content) + "}}]}";
    }

    @Test
    @DisplayName("Senza chiave il modello non parte e gli NPC usano le battute")
    void disabledWithoutKey() {
        OpenRouterNpcMind mind = new OpenRouterNpcMind(mapper, () -> "", "", MODELS, 45, 12, 15, 12_000,
                Clock.systemDefaultZone(), HttpClient.newHttpClient());
        assertFalse(mind.enabled());
        assertFalse(mind.ask(prompt(UUID.randomUUID(), NpcRoster.Role.BARISTA, List.of("cola")), r -> { }));
    }

    @Test
    @DisplayName("Solo modelli gratuiti: quelli a pagamento nella configurazione vengono ignorati")
    void onlyFreeModels() {
        OpenRouterNpcMind mind = new OpenRouterNpcMind(mapper, () -> "", "sk-test", "openai/gpt-5,anthropic/claude", 45, 12, 15,
                12_000, Clock.systemDefaultZone(), HttpClient.newHttpClient());
        assertFalse(mind.enabled(), "nessun modello :free, quindi niente chiamate");
    }

    @Test
    @DisplayName("La risposta del modello diventa testo breve e un'azione permessa")
    void parsesAndValidates() throws Exception {
        OpenRouterNpcMind mind = mind(45, 200, "");
        NpcMind.Prompt barista = prompt(UUID.randomUUID(), NpcRoster.Role.BARISTA, List.of("cocktail", "cola"));

        NpcMind.Reply reply = mind.parse("Ecco: {\"reply\": \"Per festeggiare, un cocktail!\", \"action\": \"serve:cocktail\"}", barista).orElseThrow();
        assertEquals("Per festeggiare, un cocktail!", reply.text());
        assertEquals("serve:cocktail", reply.action());

        assertNull(mind.parse("{\"reply\": \"Tieni!\", \"action\": \"serve:champagne\"}", barista).orElseThrow().action(),
                "fuori menu: niente azione");
        assertNull(mind.parse("{\"reply\": \"Balliamo!\", \"action\": \"dance\"}", barista).orElseThrow().action(),
                "il barista non balla");
        assertTrue(mind.parse("{\"reply\": \"\"}", barista).isEmpty(), "risposta vuota: si ripiega sulle battute");
        assertTrue(mind.parse(null, barista).isEmpty());
        assertTrue(mind.parse("Okay, the user is asking for a drink. Let me check the menu.", barista).isEmpty(),
                "il ragionamento in chiaro non finisce in chat");

        String longText = "Parola ".repeat(60);
        assertTrue(OpenRouterNpcMind.clean(longText).length() <= OpenRouterNpcMind.MAX_REPLY_CHARS + 3);
        assertEquals("Ciao!", OpenRouterNpcMind.clean("  \"Ciao!\"  "));
        assertEquals("Vai su e divertiti", OpenRouterNpcMind.clean("Vai su https://esempio.it e **divertiti**").replace("  ", " "));
    }

    @Test
    @DisplayName("Il prompt descrive personaggio, stanza, menu e azioni possibili")
    void systemPrompt() {
        String text = OpenRouterNpcMind.systemPrompt(prompt(UUID.randomUUID(), NpcRoster.Role.DJ, List.of()));
        assertTrue(text.contains("Vinnie"));
        assertTrue(text.contains("Neon Bar"));
        assertTrue(text.contains("\"music\""));
        assertFalse(text.contains("serve:"), "chi non ha un menu non serve");
        assertTrue(text.contains("intelligenza artificiale"), "non deve dire di essere un modello");
    }

    @Test
    @DisplayName("Una risposta del modello arriva con testo e azione")
    void answers() throws Exception {
        OpenRouterNpcMind mind = mind(45, 200, completion("{\"reply\": \"Arriva una cola!\", \"action\": \"serve:cola\"}"));
        CompletableFuture<NpcMind.Reply> result = new CompletableFuture<>();
        assertTrue(mind.ask(prompt(UUID.randomUUID(), NpcRoster.Role.BARISTA, List.of("cola")), result::complete));
        NpcMind.Reply reply = result.get(5, TimeUnit.SECONDS);
        assertEquals("Arriva una cola!", reply.text());
        assertEquals("serve:cola", reply.action());
    }

    @Test
    @DisplayName("Finito il limite giornaliero, gli NPC ripiegano sulle battute")
    void dailyLimit() throws Exception {
        OpenRouterNpcMind mind = mind(1, 200, completion("{\"reply\": \"Ciao!\", \"action\": \"none\"}"));
        assertTrue(mind.ask(prompt(UUID.randomUUID(), NpcRoster.Role.GUEST, List.of()), r -> { }));
        assertFalse(mind.ask(prompt(UUID.randomUUID(), NpcRoster.Role.GUEST, List.of()), r -> { }));
    }

    @Test
    @DisplayName("Due messaggi di fila dello stesso giocatore ricevono entrambi risposta, in ordine")
    void queuesPerUser() throws Exception {
        OpenRouterNpcMind mind = mind(45, 200, completion("{\"reply\": \"Eccomi!\", \"action\": \"none\"}"));
        UUID user = UUID.randomUUID();
        CompletableFuture<NpcMind.Reply> first = new CompletableFuture<>();
        CompletableFuture<NpcMind.Reply> second = new CompletableFuture<>();
        assertTrue(mind.ask(prompt(user, NpcRoster.Role.GUEST, List.of()), first::complete));
        assertTrue(mind.ask(prompt(user, NpcRoster.Role.GUEST, List.of()), second::complete));
        assertEquals("Eccomi!", first.get(5, TimeUnit.SECONDS).text());
        assertEquals("Eccomi!", second.get(5, TimeUnit.SECONDS).text());
    }

    @Test
    @DisplayName("Un 429 del limite giornaliero ferma il modello fino a domani e la risposta e' null")
    void rateLimitedByOpenRouter() throws Exception {
        OpenRouterNpcMind mind = mind(45, 429, "{\"error\":{\"message\":\"Rate limit exceeded: free-models-per-day\"}}");
        CompletableFuture<NpcMind.Reply> result = new CompletableFuture<>();
        assertTrue(mind.ask(prompt(UUID.randomUUID(), NpcRoster.Role.GUEST, List.of()), result::complete));
        assertNull(result.get(5, TimeUnit.SECONDS));
        assertFalse(mind.ask(prompt(UUID.randomUUID(), NpcRoster.Role.GUEST, List.of()), r -> { }));
    }
}
