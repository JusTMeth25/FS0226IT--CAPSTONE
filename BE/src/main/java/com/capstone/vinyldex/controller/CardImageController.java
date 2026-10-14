package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.TimeUnit;

/**
 * Ripropone dal nostro dominio l'immagine di una carta importata da una fonte esterna.
 *
 * Il frontend disegna le carte anche in WebGL, e WebGL accetta un'immagine di un altro dominio
 * solo se quel server manda gli header CORS: molte fonti (Yu-Gi-Oh!, TCGplayer, ...) non lo fanno.
 * Passando da qui l'immagine arriva con la configurazione CORS del backend.
 *
 * L'URL da scaricare non arriva mai dalla richiesta: viene letto dalla carta salvata nel database.
 * Cosi' l'endpoint non puo' essere usato per far chiamare al server indirizzi arbitrari.
 */
@RestController
@RequestMapping("/api")
public class CardImageController {

    /** Le immagini delle carte pesano poche centinaia di KB: oltre questa soglia qualcosa non va. */
    private static final int MAX_IMAGE_BYTES = 8 * 1024 * 1024;

    private final CardRepository cardRepository;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public CardImageController(CardRepository cardRepository) {
        this.cardRepository = cardRepository;
    }

    private com.capstone.vinyldex.importer.CardImageAudit imageAudit;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    void setImageAudit(com.capstone.vinyldex.importer.CardImageAudit imageAudit) {
        this.imageAudit = imageAudit;
    }

    /** id e' il code pubblico della carta, come in GET /api/cards/{id}. */
    @GetMapping("/cards/{id}/image")
    public ResponseEntity<byte[]> getCardImage(@PathVariable String id) {
        Card card = cardRepository.findByCode(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "card_not_found"));

        String url = card.getImgUrl();
        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
            throw new ApiException(HttpStatus.NOT_FOUND, "image_not_found");
        }

        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(15))
                .header("User-Agent", "VinylDex/1.0 (capstone project)")
                .header("Accept", "image/*")
                .GET()
                .build();

        try {
            HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
            String contentType = response.headers().firstValue("Content-Type").orElse("");

            try (InputStream body = response.body()) {
                if (response.statusCode() != 200 || !contentType.startsWith("image/")) {
                    // Immagine che la fonte non ha (403/404): la carta si spegne subito per tutti.
                    if (imageAudit != null && com.capstone.vinyldex.importer.CardImageAudit.classify(response.statusCode(), contentType)
                            == com.capstone.vinyldex.importer.CardImageAudit.Result.BROKEN) {
                        imageAudit.markBroken(url, response.statusCode());
                    }
                    throw new ApiException(HttpStatus.BAD_GATEWAY, "image_unavailable");
                }
                byte[] bytes = body.readNBytes(MAX_IMAGE_BYTES + 1);
                if (bytes.length > MAX_IMAGE_BYTES) {
                    throw new ApiException(HttpStatus.BAD_GATEWAY, "image_too_large");
                }

                // L'immagine di una carta non cambia: il browser puo' tenerla a lungo.
                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(contentType))
                        .cacheControl(CacheControl.maxAge(7, TimeUnit.DAYS).cachePublic())
                        .body(bytes);
            }
        } catch (IOException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "image_unavailable");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ApiException(HttpStatus.BAD_GATEWAY, "image_unavailable");
        }
    }
}
