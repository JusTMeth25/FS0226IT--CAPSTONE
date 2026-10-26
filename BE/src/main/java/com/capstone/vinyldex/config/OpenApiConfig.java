package com.capstone.vinyldex.config;

import com.capstone.vinyldex.security.AuthCookies;
import com.capstone.vinyldex.security.CurrentUser;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.HeaderParameter;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springdoc.core.utils.SpringDocUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;
import java.util.Set;

/**
 * Documentazione OpenAPI 3 delle API REST, letta da springdoc dalle annotazioni dei controller.
 * La pagina Swagger UI e' in /api/docs, il JSON in /api/docs/openapi.json (vedi application.properties).
 *
 * Due modi di autenticarsi, come nel resto del backend:
 * - bearerAuth: header "Authorization: Bearer ...", usato dall'app nativa e dalle prove da Swagger UI;
 * - cookieAuth: il cookie HttpOnly del sito. Col cookie le richieste che modificano dati vogliono
 *   anche l'header X-VinylDex-Client (difesa CSRF, vedi JwtAuthenticationFilter): per questo
 *   {@link #clientHeader()} lo aggiunge, gia' compilato, a tutte le operazioni che non sono GET.
 */
@Configuration
public class OpenApiConfig {

    public static final String BEARER = "bearerAuth";
    public static final String COOKIE = "cookieAuth";

    private static final String DESCRIPTION = """
            API di **VinylDex**, piattaforma di collezionismo di carte (Pokemon, Magic, Yu-Gi-Oh!, \
            EA FC, NBA e altre): collezione e raccoglitore, apertura di pacchetti, mercato fra \
            giocatori, scambi, battaglie, missioni ed eventi, classifiche, casinò, borsa e un hotel \
            virtuale in stile Habbo.

            L'hotel in tempo reale (movimento, chat, mobili, minigiochi) passa dal WebSocket \
            `/ws/hotel`, che non è descritto qui: questa pagina copre solo le API REST.

            ### Autenticazione
            - **Sito**: dopo il login il token arriva nel cookie HttpOnly `vinyldex_session`. Col \
            cookie, le richieste che modificano dati (POST, PUT, PATCH, DELETE) devono avere l'header \
            `X-VinylDex-Client`, altrimenti rispondono 403 `csrf_blocked`.
            - **App nativa e prove da qui**: `POST /api/auth/login` con l'header \
            `X-VinylDex-Client: native` restituisce il token JWT anche nel corpo della risposta \
            (campo `token`). Copialo in **Authorize** (bearerAuth) e usa "Try it out": col Bearer \
            l'header `X-VinylDex-Client` non serve, ma è già compilato nelle operazioni che \
            modificano dati, così funzionano anche col cookie del sito.

            Gli errori hanno la forma `{"error": "codice"}`. Le operazioni senza lucchetto sono \
            pubbliche; quelle del gruppo Admin richiedono il ruolo ADMIN.
            """;

    static {
        // L'utente autenticato arriva dal token, non dalla richiesta: non e' un parametro da documentare.
        SpringDocUtils.getConfig().addAnnotationsToIgnore(CurrentUser.class);
    }

    @Bean
    public OpenAPI vinylDexOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("VinylDex API")
                        .version("1.0")
                        .description(DESCRIPTION)
                        .contact(new Contact().name("VinylDex").url("https://vinyldex.duckdns.org")))
                // Il primo e' quello scelto da "Try it out": lo stesso indirizzo della pagina, cosi' le
                // prove fatte in locale non partono verso la produzione (e viceversa).
                .servers(List.of(
                        new Server().url("/").description("Questo server"),
                        new Server().url("https://vinyldex.duckdns.org").description("Produzione"),
                        new Server().url("http://localhost:4000").description("Locale")))
                .components(new Components()
                        .addSecuritySchemes(BEARER, new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Token JWT: POST /api/auth/login con l'header X-VinylDex-Client: native lo restituisce nel corpo."))
                        .addSecuritySchemes(COOKIE, new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.COOKIE)
                                .name(AuthCookies.NAME)
                                .description("Cookie di sessione del sito. Le richieste che modificano dati vogliono anche l'header X-VinylDex-Client.")))
                // Basta uno dei due: Bearer oppure cookie.
                .addSecurityItem(new SecurityRequirement().addList(BEARER))
                .addSecurityItem(new SecurityRequirement().addList(COOKIE));
    }

    /** Header X-VinylDex-Client facoltativo su ogni operazione che modifica dati, gia' valorizzato a "native". */
    @Bean
    public OpenApiCustomizer clientHeader() {
        Set<PathItem.HttpMethod> writes = Set.of(PathItem.HttpMethod.POST, PathItem.HttpMethod.PUT,
                PathItem.HttpMethod.PATCH, PathItem.HttpMethod.DELETE);
        return openApi -> {
            if (openApi.getPaths() == null) return;
            openApi.getPaths().values().forEach(item -> item.readOperationsMap().forEach((method, operation) -> {
                if (!writes.contains(method)) return;
                boolean present = operation.getParameters() != null && operation.getParameters().stream()
                        .anyMatch(p -> AuthCookies.CLIENT_HEADER.equalsIgnoreCase(p.getName()));
                if (present) return;
                StringSchema schema = new StringSchema();
                schema.setDefault("native");
                operation.addParametersItem(new HeaderParameter()
                        .name(AuthCookies.CLIENT_HEADER)
                        .required(false)
                        .description("Obbligatorio solo con il cookie di sessione (difesa CSRF). Con \"native\" il login restituisce il token nel corpo.")
                        .schema(schema));
            }));
        };
    }

    /** Nomi e descrizioni dei gruppi di Swagger UI, condivisi dai controller della stessa area. */
    public static final class Tags {
        public static final String ADMIN = "Admin";
        public static final String ADMIN_INFO = "Solo amministratori (ruolo ADMIN)";
        public static final String AMICI = "Amici";
        public static final String AMICI_INFO = "Amicizie e messaggi privati fra giocatori";
        public static final String AUTH = "Autenticazione";
        public static final String AUTH_INFO = "Registrazione, accesso (email, Google), password dimenticata e verifica in due passaggi";
        public static final String BATTAGLIE = "Battaglie";
        public static final String BATTAGLIE_INFO = "Avversari, squadre e ricompense delle battaglie";
        public static final String BORSA = "Borsa";
        public static final String BORSA_INFO = "Borsa di Wall Street: listino, grafici, portafoglio e ordini";
        public static final String CARTE = "Carte";
        public static final String CARTE_INFO = "Catalogo pubblico delle carte: dettaglio, immagini, carta del giorno e storico prezzi";
        public static final String CASINO = "Casinò";
        public static final String CASINO_INFO = "Casinò dell'hotel: fiches, slot, roulette, blackjack, video poker, baccarat e craps";
        public static final String CLASSIFICA = "Classifica";
        public static final String CLASSIFICA_INFO = "Classifiche dei giocatori";
        public static final String COLLEZIONE = "Collezione";
        public static final String COLLEZIONE_INFO = "Carte possedute, raccoglitore, lista dei desideri, squadre, set, fusione e gradazione";
        public static final String COMMUNITY = "Community";
        public static final String COMMUNITY_INFO = "Club, feste, banchetti, foto e posta dell'hotel";
        public static final String EVENTI = "Eventi";
        public static final String EVENTI_INFO = "Eventi del gioco e dell'hotel";
        public static final String GUARDAROBA = "Guardaroba";
        public static final String GUARDAROBA_INFO = "Negozi del quartiere: capi, orologi e veicoli, e il loro mercato dell'usato";
        public static final String HOTEL = "Hotel";
        public static final String HOTEL_INFO = "Hotel virtuale: stanze, mobili, incarichi, asta, mostra, animali, tornei. Il tempo reale passa dal WebSocket /ws/hotel";
        public static final String MERCATO = "Mercato";
        public static final String MERCATO_INFO = "Annunci di vendita fra giocatori, prezzi medi e ricompra delle carte dal negozio";
        public static final String MISSIONI = "Missioni";
        public static final String MISSIONI_INFO = "Missioni e premio dell'accesso giornaliero";
        public static final String PACCHETTI = "Pacchetti";
        public static final String PACCHETTI_INFO = "Pacchetti in vendita, apertura e probabilità";
        public static final String PROFILO = "Profilo";
        public static final String PROFILO_INFO = "Profilo dell'utente collegato, avatar e aspetto nell'hotel";
        public static final String SCAMBI = "Scambi";
        public static final String SCAMBI_INFO = "Proposte di scambio di carte fra giocatori e scambi con gli NPC";
        public static final String SISTEMA = "Sistema";
        public static final String SISTEMA_INFO = "Stato del servizio";

        private Tags() {
        }
    }
}
