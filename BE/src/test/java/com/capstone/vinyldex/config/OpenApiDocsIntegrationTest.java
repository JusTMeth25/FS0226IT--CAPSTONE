package com.capstone.vinyldex.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Documentazione delle API: la pagina Swagger UI e il JSON OpenAPI devono rispondere senza login,
 * con il server vero (catena di filtri compresa: RateLimitFilter, JwtAuthenticationFilter e
 * le regole di SecurityConfig).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = "vinyldex.fc27.seed-ea-players=0")
@EnabledIf("com.capstone.vinyldex.VinylDexApplicationTests#credenzialiDatabasePresenti")
class OpenApiDocsIntegrationTest {

    @LocalServerPort
    private int port;

    private final HttpClient http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();

    private HttpResponse<String> get(String path) throws Exception {
        HttpRequest request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET().build();
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }

    @Test
    @DisplayName("/api/docs/openapi.json e' pubblico e descrive VinylDex con le aree principali e il Bearer")
    void openApiJsonIsPublic() throws Exception {
        HttpResponse<String> response = get("/api/docs/openapi.json");
        assertEquals(200, response.statusCode());
        assertTrue(response.body().contains("\"VinylDex API\""));

        JsonNode doc = new ObjectMapper().readTree(response.body());
        Set<String> tags = new HashSet<>();
        doc.get("tags").forEach(tag -> tags.add(tag.get("name").asString()));
        for (String expected : Set.of("Autenticazione", "Collezione", "Carte", "Pacchetti", "Mercato",
                "Scambi", "Battaglie", "Hotel", "Admin")) {
            assertTrue(tags.contains(expected), "manca il tag " + expected);
        }

        JsonNode bearer = doc.get("components").get("securitySchemes").get("bearerAuth");
        assertEquals("http", bearer.get("type").asString());
        assertEquals("bearer", bearer.get("scheme").asString());

        // Il login e' pubblico: nessun lucchetto in Swagger UI.
        JsonNode login = doc.get("paths").get("/api/auth/login").get("post");
        assertEquals(0, login.get("security").size());
    }

    @Test
    @DisplayName("/api/docs porta alla pagina Swagger UI, servita senza login")
    void swaggerUiIsPublic() throws Exception {
        HttpResponse<String> docs = get("/api/docs");
        int status = docs.statusCode();
        assertTrue(status == 200 || (status >= 300 && status < 400), "stato inatteso: " + status);

        String page = status == 200 ? "/api/docs"
                : URI.create(docs.headers().firstValue("Location").orElseThrow()).getPath();
        HttpResponse<String> ui = get(page);
        assertEquals(200, ui.statusCode());
        assertTrue(ui.body().contains("swagger-ui"));
    }
}
