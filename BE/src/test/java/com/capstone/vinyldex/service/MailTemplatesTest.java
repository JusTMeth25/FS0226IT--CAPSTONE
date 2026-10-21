package com.capstone.vinyldex.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class MailTemplatesTest {

    private final MailTemplates templates = new MailTemplates("https://vinyldex.example/");

    private static void assertComplete(String out) {
        assertFalse(out.contains("${"), "variabile non sostituita");
        assertFalse(out.contains("[("), "variabile di testo non sostituita");
        assertFalse(out.matches("(?s).*\\sth:[a-z]+=.*"), "attributo Thymeleaf rimasto nell'email");
    }

    @Test
    @DisplayName("Reset della password: link, minuti e nome in HTML e testo, stile del sito")
    void resetPassword() {
        String link = "https://vinyldex.example/#/reset-password?token=abc123";
        MailTemplates.Rendered mail = templates.render("reset-password", "Reimposta la password di VinylDex", "Nuova password",
                Map.of("username", "lorenzo", "link", link, "minutes", 30L));

        assertEquals("Reimposta la password di VinylDex", mail.subject());
        assertTrue(mail.html().contains("href=\"" + link + "\""));
        assertTrue(mail.html().contains("lorenzo"));
        assertTrue(mail.html().contains("30 minuti"));
        assertTrue(mail.html().contains("#ec4899"), "fascia magenta dello stile Phantom");
        assertTrue(mail.html().contains("https://vinyldex.example/icon-192.png"), "logo dal sito, senza doppia barra");
        assertTrue(mail.text().contains(link));
        assertTrue(mail.text().contains("Ciao lorenzo,"));
        assertComplete(mail.html());
        assertComplete(mail.text());
    }

    @Test
    @DisplayName("Password cambiata: avviso e link per chiederne una nuova")
    void passwordChanged() {
        MailTemplates.Rendered mail = templates.render("password-changed", "La password di VinylDex è cambiata", "Password cambiata",
                Map.of("username", "lorenzo", "forgotUrl", "https://vinyldex.example/#/forgot-password"));

        assertTrue(mail.html().contains("Non sei stato tu?"));
        assertTrue(mail.html().contains("href=\"https://vinyldex.example/#/forgot-password\""));
        assertTrue(mail.text().contains("https://vinyldex.example/#/forgot-password"));
        assertComplete(mail.html());
        assertComplete(mail.text());
    }

    @Test
    @DisplayName("Un nome utente con caratteri HTML non entra come codice nell'email")
    void escapesUsername() {
        MailTemplates.Rendered mail = templates.render("password-changed", "Oggetto", "Titolo",
                Map.of("username", "<script>alert(1)</script>&co", "forgotUrl", "https://vinyldex.example/#/forgot-password"));

        assertFalse(mail.html().contains("<script>"));
        assertTrue(mail.html().contains("&lt;script&gt;"));
    }

    @Test
    @DisplayName("Titolo a ritaglio: una lista di tasselli per parola, maiuscole, colori alternati")
    void ransomTitle() {
        List<List<MailTemplates.Letter>> words = MailTemplates.ransom("Nuova password");

        assertEquals(2, words.size());
        assertEquals(5, words.get(0).size());
        assertEquals(8, words.get(1).size());
        assertEquals("N", words.getFirst().getFirst().ch());
        assertNotEquals(words.get(0).get(0).background(), words.get(0).get(1).background());
        assertTrue(words.stream().flatMap(List::stream).anyMatch(l -> l.background().equals("#ec4899")), "almeno un tassello magenta");
    }
}
