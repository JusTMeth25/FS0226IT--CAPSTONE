package com.capstone.vinyldex.service;

import com.capstone.vinyldex.dto.request.AiRequests;
import com.capstone.vinyldex.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.JsonNode;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Generazione immagini con OpenAI.
 *
 * La chiave resta sul server e non viene mai esposta al client. Le immagini tornano come data URL
 * in base64, cosi' il frontend puo' mostrarle subito senza bisogno di archiviarle.
 */
@Service
public class OpenAiImageService {

    private static final Logger log = LoggerFactory.getLogger(OpenAiImageService.class);
    private static final String IMAGES_ENDPOINT = "https://api.openai.com/v1/images/generations";
    private static final String IMAGE_MODEL = "dall-e-3";

    private final RestClient restClient;
    private final String apiKey;

    public OpenAiImageService(@Value("${vinyldex.openai.api-key:}") String apiKey) {
        this.apiKey = apiKey;

        // La generazione di un'immagine richiede decine di secondi: il timeout di lettura
        // dev'essere molto piu' largo di quello usato per gli import di carte.
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofMinutes(2));
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    private boolean hasKey() {
        return apiKey != null && apiKey.length() > 10;
    }

    /**
     * Genera le immagini una dopo l'altra.
     *
     * In sequenza e non in parallelo: OpenAI applica un limite di richieste al minuto e una
     * raffica di chiamate verrebbe respinta. Un fallimento singolo non ferma il batch, finisce
     * come esito negativo di quella sola voce.
     */
    public List<GenerationResult> generateBatch(AiRequests.GenerateBatchRequest request) {
        if (!hasKey()) {
            throw new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE, "openai_not_configured");
        }

        String size = request.sizeOrDefault();
        List<GenerationResult> results = new ArrayList<>(request.items().size());

        for (AiRequests.GenerateItem item : request.items()) {
            try {
                results.add(generateOne(item.id(), item.prompt(), size));
            } catch (Exception ex) {
                log.warn("Generazione immagine fallita per {}: {}", item.id(), ex.getMessage());
                results.add(GenerationResult.failure(item.id(), ex.getMessage()));
            }
        }

        return results;
    }

    private GenerationResult generateOne(String id, String prompt, String size) {
        Map<String, Object> payload = Map.of(
                "model", IMAGE_MODEL,
                "prompt", prompt,
                "n", 1,
                "size", size,
                "response_format", "b64_json");

        JsonNode body = restClient.post()
                .uri(IMAGES_ENDPOINT)
                .header("Authorization", "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(JsonNode.class);

        JsonNode data = body == null ? null : body.get("data");
        JsonNode entry = data != null && data.isArray() && !data.isEmpty() ? data.get(0) : null;
        JsonNode base64 = entry == null ? null : entry.get("b64_json");

        if (base64 == null || base64.isNull()) {
            throw new IllegalStateException("Risposta OpenAI senza b64_json");
        }

        JsonNode revised = entry.get("revised_prompt");
        return GenerationResult.success(id,
                "data:image/png;base64," + base64.asString(),
                revised == null || revised.isNull() ? null : revised.asString());
    }

    public record GenerationResult(String id, boolean success, String dataUrl, String revisedPrompt, String error) {

        static GenerationResult success(String id, String dataUrl, String revisedPrompt) {
            return new GenerationResult(id, true, dataUrl, revisedPrompt, null);
        }

        static GenerationResult failure(String id, String error) {
            return new GenerationResult(id, false, null, null, error);
        }
    }
}
