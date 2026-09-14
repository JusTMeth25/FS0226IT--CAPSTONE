package com.capstone.vinyldex.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Corpi delle richieste di generazione immagini. */
public final class AiRequests {

    private AiRequests() {
    }

    /**
     * Un batch alla volta, al massimo 20 immagini: ogni immagine e' una chiamata a pagamento
     * e una richiesta piu' grande resterebbe appesa per minuti.
     */
    public record GenerateBatchRequest(
            @NotEmpty(message = "invalid_input")
            @Size(max = 20, message = "too_many_items")
            @Valid List<GenerateItem> items,

            String size
    ) {
        public String sizeOrDefault() {
            return size == null || size.isBlank() ? "1024x1024" : size;
        }
    }

    public record GenerateItem(
            String id,
            @NotBlank(message = "invalid_input") String prompt
    ) {
    }
}
