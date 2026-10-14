package com.capstone.vinyldex.importer;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Carte con l'immagine rotta: si spengono, restano spente al nuovo import, tornano se l'immagine torna. */
@SpringBootTest(properties = {"vinyldex.fc27.seed-ea-players=0", "vinyldex.images.audit.enabled=false"})
@EnabledIf("com.capstone.vinyldex.VinylDexApplicationTests#credenzialiDatabasePresenti")
class CardImageAuditIntegrationTest {

    @Autowired
    private CardImageAudit audit;
    @Autowired
    private CardImportWriter writer;
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("Solo 403/404/410 e le risposte che non sono immagini contano come rotte")
    void classify() {
        assertEquals(CardImageAudit.Result.OK, CardImageAudit.classify(200, "image/jpeg"));
        assertEquals(CardImageAudit.Result.OK, CardImageAudit.classify(206, "image/webp"));
        assertEquals(CardImageAudit.Result.BROKEN, CardImageAudit.classify(403, "application/xml"));
        assertEquals(CardImageAudit.Result.BROKEN, CardImageAudit.classify(404, null));
        assertEquals(CardImageAudit.Result.BROKEN, CardImageAudit.classify(200, "text/html"));
        assertEquals(CardImageAudit.Result.UNKNOWN, CardImageAudit.classify(500, null));
        assertEquals(CardImageAudit.Result.UNKNOWN, CardImageAudit.classify(429, null));
    }

    @Test
    @DisplayName("Immagine rotta: carta spenta anche dopo un nuovo import; immagine tornata: carta riaccesa")
    void brokenStaysOffAcrossImports() {
        String source = "imgtest";
        String id = UUID.randomUUID().toString().substring(0, 8);
        String url = "https://example.invalid/" + id + ".jpg";
        ImportedCard card = new ImportedCard(id, "imgtest-" + id, "Carta rotta " + id, "Set di prova", "TST", "1",
                "common", url, null, new java.util.HashMap<>());
        try {
            writer.persist(source, List.of(card), null);
            assertTrue(active(id), "importata attiva");

            assertEquals(1, audit.markBroken(url, 403));
            assertFalse(active(id));
            assertTrue(audit.brokenUrls().contains(url));

            writer.persist(source, List.of(card), null);
            assertFalse(active(id), "il nuovo import non la riaccende");

            assertEquals(1, audit.markOk(url));
            assertTrue(active(id), "immagine tornata: carta di nuovo attiva");
            assertEquals(0, audit.markOk(url), "gia' buona: niente da fare");
        } finally {
            jdbc.update("DELETE FROM cards WHERE source = ? AND external_id = ?", source, id);
            jdbc.update("DELETE FROM card_image_checks WHERE img_url = ?", url);
            jdbc.update("DELETE FROM external_card_sources WHERE source = ?", source);
        }
    }

    private boolean active(String externalId) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT is_active FROM cards WHERE source = 'imgtest' AND external_id = ?", Boolean.class, externalId));
    }
}
