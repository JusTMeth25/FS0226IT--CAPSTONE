package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.importer.sources.Fc27Importer;
import com.capstone.vinyldex.repository.CardRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.imageio.ImageIO;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * Immagine delle carte EA FC 27: una carta in stile Ultimate Team disegnata qui, in SVG.
 *
 * Sfondo e colori dipendono dalla versione (oro raro, icona, eroe, TOTW...), poi valutazione,
 * ruolo, nome e le sei statistiche. Se la fonte ha la foto del giocatore (classifica EA, o FutDB
 * con la chiave), la foto si scarica dal server, si rimpicciolisce e si incorpora nella carta;
 * altrimenti c'e' una sagoma.
 *
 * Essendo un'immagine normale funziona ovunque: collezione, dettaglio, carta 3D, pacchetti e
 * il canvas dell'hotel. Stesso dominio del backend, quindi niente problemi di CORS.
 */
@RestController
@RequestMapping("/api")
public class FcCardArtController {

    private static final int MAX_PHOTO_BYTES = 2 * 1024 * 1024;
    /** Lato della foto incorporata: il riquadro e' 150x150, il doppio resta nitido sugli schermi densi. */
    private static final int PHOTO_SIZE = 300;
    /** Foto tenute in memoria (~60 KB l'una una volta rimpicciolite). */
    private static final int PHOTO_CACHE_SIZE = 400;
    private static final String FUTDB_HOST = "futdb.app";
    /** Solo questi siti: la chiave FutDB non deve mai partire verso altri indirizzi. */
    private static final Set<String> PHOTO_HOSTS = Set.of("ratings-images-prod.pulse.ea.com", FUTDB_HOST);

    /** Colori per versione: sfondo (due tinte), bordo, testo. */
    private record Palette(String from, String to, String edge, String text, String accent) {
    }

    private static final Map<String, Palette> PALETTES = Map.of(
            "icon", new Palette("#fffaf0", "#e4cf95", "#b8943f", "#3a2c12", "#9a7a2c"),
            "hero", new Palette("#5b2a86", "#2a1147", "#e9c46a", "#fff4d6", "#e9c46a"),
            "totw", new Palette("#2a2a2a", "#0b0b0b", "#e3b341", "#f5d77a", "#e3b341"),
            "silver", new Palette("#eef1f4", "#a9b1ba", "#7b8490", "#2a2f36", "#59626d"),
            "bronze", new Palette("#e8b98a", "#9a5a2e", "#6e3d1c", "#2d1708", "#6e3d1c"),
            "gold_rare", new Palette("#fbe68a", "#caa233", "#8f6c12", "#3b2a06", "#7a5a0c"));

    private final CardRepository cardRepository;
    private final String apiKey;
    private final Map<String, String> photos = Collections.synchronizedMap(new LinkedHashMap<>(64, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, String> eldest) {
            return size() > PHOTO_CACHE_SIZE;
        }
    });
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public FcCardArtController(CardRepository cardRepository, @Value("${vinyldex.futdb.api-key:}") String apiKey) {
        this.cardRepository = cardRepository;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
    }

    /** id e' il code pubblico della carta, come in GET /api/cards/{id}. */
    @GetMapping(value = "/cards/{id}/fc-card.svg")
    public ResponseEntity<byte[]> card(@PathVariable String id) {
        Card card = cardRepository.findByCode(id)
                .filter(c -> Fc27Importer.SOURCE.equals(c.getSource()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "card_not_found"));
        String svg = render(card.getName(), card.getMetadata(), photoOf(card));
        return ResponseEntity.ok()
                .contentType(MediaType.valueOf("image/svg+xml"))
                .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic())
                .body(svg.getBytes(StandardCharsets.UTF_8));
    }

    /** Foto del giocatore come data URI, scaricata una volta sola; null se non c'e'. */
    private String photoOf(Card card) {
        Object url = card.getMetadata() == null ? null : card.getMetadata().get("photoUrl");
        if (!(url instanceof String photoUrl)) return null;
        URI uri;
        try {
            uri = URI.create(photoUrl);
        } catch (IllegalArgumentException ex) {
            return null;
        }
        if (!"https".equals(uri.getScheme()) || !PHOTO_HOSTS.contains(uri.getHost())) return null;
        String cached = photos.get(card.getCode());
        if (cached != null) return cached.isEmpty() ? null : cached;
        String dataUri = "";
        try {
            HttpRequest.Builder request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(10))
                    .header("Accept", "image/*");
            if (!apiKey.isEmpty() && FUTDB_HOST.equals(uri.getHost())) request.header("X-AUTH-TOKEN", apiKey);
            HttpResponse<InputStream> response = httpClient.send(request.GET().build(), HttpResponse.BodyHandlers.ofInputStream());
            String type = response.headers().firstValue("Content-Type").orElse("");
            try (InputStream body = response.body()) {
                byte[] bytes = body.readNBytes(MAX_PHOTO_BYTES + 1);
                if (response.statusCode() == 200 && type.startsWith("image/") && bytes.length <= MAX_PHOTO_BYTES) {
                    byte[] small = shrink(bytes);
                    dataUri = small != null
                            ? "data:image/png;base64," + Base64.getEncoder().encodeToString(small)
                            : "data:" + type.split(";")[0] + ";base64," + Base64.getEncoder().encodeToString(bytes);
                }
            }
        } catch (Exception ex) {
            if (ex instanceof InterruptedException) Thread.currentThread().interrupt();
        }
        photos.put(card.getCode(), dataUri);
        return dataUri.isEmpty() ? null : dataUri;
    }

    /**
     * Le foto EA sono PNG da ~400 KB: rimpicciolite a PHOTO_SIZE pesano un decimo e la carta si
     * carica in fretta anche nei pacchetti. null se l'immagine non si legge (si usa l'originale).
     */
    static byte[] shrink(byte[] bytes) throws IOException {
        BufferedImage source = ImageIO.read(new ByteArrayInputStream(bytes));
        if (source == null) return null;
        double scale = Math.min(1.0, (double) PHOTO_SIZE / Math.max(source.getWidth(), source.getHeight()));
        int width = Math.max(1, (int) Math.round(source.getWidth() * scale));
        int height = Math.max(1, (int) Math.round(source.getHeight() * scale));
        BufferedImage target = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB);
        var g = target.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(source, 0, 0, width, height, null);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(target, "png", out);
        return out.toByteArray();
    }

    /** La carta in SVG, 250x350 come le carte da collezione (63x88 mm). */
    static String render(String name, Map<String, Object> meta, String photo) {
        Map<String, Object> m = meta == null ? Map.of() : meta;
        String version = str(m, "version", "gold_rare");
        Palette p = PALETTES.getOrDefault(version, PALETTES.get("gold_rare"));
        String position = str(m, "position", "");
        boolean gk = "GK".equalsIgnoreCase(position);
        String[] labels = gk ? new String[]{"DIV", "HAN", "KIC", "REF", "SPD", "POS"}
                : new String[]{"PAC", "SHO", "PAS", "DRI", "DEF", "PHY"};
        String[] keys = {"pac", "sho", "pas", "dri", "def", "phy"};
        String shield = "M125 8 L150 22 L236 22 L242 70 L242 262 Q242 300 206 316 L125 346 L44 316 Q8 300 8 262 L8 70 L14 22 L100 22 Z";

        StringBuilder s = new StringBuilder();
        s.append("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 250 350' width='250' height='350'>");
        s.append("<defs><linearGradient id='bg' x1='0' y1='0' x2='1' y2='1'>")
                .append("<stop offset='0' stop-color='").append(p.from()).append("'/>")
                .append("<stop offset='1' stop-color='").append(p.to()).append("'/></linearGradient>")
                .append("<linearGradient id='shine' x1='0' y1='0' x2='1' y2='0'>")
                .append("<stop offset='0' stop-color='#fff' stop-opacity='0'/>")
                .append("<stop offset='.5' stop-color='#fff' stop-opacity='.35'/>")
                .append("<stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>")
                .append("<clipPath id='card'><path d='").append(shield).append("'/></clipPath></defs>");
        s.append("<rect width='250' height='350' fill='#0b0720'/>");
        s.append("<path d='").append(shield).append("' fill='url(#bg)' stroke='").append(p.edge()).append("' stroke-width='4'/>");
        s.append("<g clip-path='url(#card)'>");
        // Motivo a raggi e riflesso diagonale, come le carte speciali.
        for (int i = 0; i < 9; i++) {
            s.append("<path d='M125 110 L").append(-40 + i * 42).append(" -20 L").append(-20 + i * 42)
                    .append(" -20 Z' fill='").append(p.edge()).append("' opacity='.08'/>");
        }
        s.append("<rect x='-80' y='0' width='70' height='420' fill='url(#shine)' transform='rotate(22 125 175)'/>");
        if (photo != null) {
            s.append("<image href='").append(photo).append("' x='88' y='34' width='150' height='150' preserveAspectRatio='xMidYMax slice'/>");
        } else {
            // Sagoma del giocatore: testa e spalle.
            s.append("<g fill='").append(p.text()).append("' opacity='.22'>")
                    .append("<circle cx='165' cy='86' r='34'/>")
                    .append("<path d='M100 186 Q104 128 165 124 Q226 128 230 186 Z'/></g>");
        }
        s.append("</g>");

        s.append("<text x='54' y='82' text-anchor='middle' font-family='Arial Black,Arial,sans-serif' font-weight='900' font-size='44' fill='")
                .append(p.text()).append("'>").append(str(m, "ovr", "")).append("</text>");
        s.append("<text x='54' y='108' text-anchor='middle' font-family='Arial,sans-serif' font-weight='700' font-size='20' fill='")
                .append(p.text()).append("'>").append(escape(position)).append("</text>");
        s.append("<text x='54' y='132' text-anchor='middle' font-family='Arial,sans-serif' font-size='11' fill='")
                .append(p.accent()).append("'>").append(escape(shortText(str(m, "nation", ""), 12))).append("</text>");
        s.append("<text x='54' y='148' text-anchor='middle' font-family='Arial,sans-serif' font-size='10' fill='")
                .append(p.accent()).append("'>").append(escape(shortText(str(m, "club", ""), 14))).append("</text>");

        String displayName = shortText(lastName(name), 16).toUpperCase(Locale.ROOT);
        int nameSize = displayName.length() > 12 ? 19 : 23;
        s.append("<text x='125' y='214' text-anchor='middle' font-family='Arial Black,Arial,sans-serif' font-weight='900' font-size='")
                .append(nameSize).append("' fill='").append(p.text()).append("'>").append(escape(displayName)).append("</text>");
        s.append("<line x1='40' y1='226' x2='210' y2='226' stroke='").append(p.accent()).append("' stroke-opacity='.6'/>");
        s.append("<line x1='125' y1='234' x2='125' y2='300' stroke='").append(p.accent()).append("' stroke-opacity='.4'/>");
        for (int i = 0; i < 6; i++) {
            int x = i < 3 ? 52 : 142;
            int y = 254 + (i % 3) * 22;
            s.append("<text x='").append(x).append("' y='").append(y)
                    .append("' font-family='Arial,sans-serif' font-size='18' fill='").append(p.text()).append("'>")
                    .append("<tspan font-weight='900'>").append(str(m, keys[i], "")).append("</tspan>")
                    .append("<tspan dx='6' font-size='14'>").append(labels[i]).append("</tspan></text>");
        }
        String badge = "icon".equals(version) ? "ICON" : "hero".equals(version) ? "HERO" : "FC 27";
        s.append("<text x='125' y='330' text-anchor='middle' font-family='Arial,sans-serif' font-weight='700' font-size='10' letter-spacing='2' fill='")
                .append(p.accent()).append("'>").append(badge).append("</text>");
        // Fonte e diritti: dati e foto dalla classifica ufficiale EA SPORTS FC.
        s.append("<text x='125' y='341' text-anchor='middle' font-family='Arial,sans-serif' font-size='6' fill-opacity='0.7' fill='")
                .append(p.text()).append("'>Dati EA SPORTS FC™ 27 · © Electronic Arts Inc.</text>");
        s.append("</svg>");
        return s.toString();
    }

    /** Sulla carta va il cognome, come in Ultimate Team; i nomi d'arte (Pedri, Rodri) restano interi. */
    private static String lastName(String name) {
        if (name == null) return "";
        String[] parts = name.trim().split("\\s+");
        if (parts.length <= 1) return name.trim();
        String last = parts[parts.length - 1];
        if (last.length() <= 2 || last.endsWith(".")) return name.trim();
        // Particelle del cognome: "van Dijk", "de Jong", "van Basten" restano insieme.
        int start = parts.length - 1;
        while (start > 1 && parts[start - 1].matches("van|de|da|di|dos|von|der|den|del|la|le")) start--;
        return String.join(" ", java.util.Arrays.copyOfRange(parts, start, parts.length));
    }

    private static String str(Map<String, Object> meta, String key, String fallback) {
        Object value = meta.get(key);
        if (value == null) return fallback;
        if (value instanceof Number n) return String.valueOf(Math.round(n.doubleValue()));
        return value.toString();
    }

    private static String shortText(String text, int max) {
        return text.length() <= max ? text : text.substring(0, max - 1) + "…";
    }

    private static String escape(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("'", "&apos;");
    }
}
