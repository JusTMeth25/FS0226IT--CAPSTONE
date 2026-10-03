package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.importer.sources.NbaImporter;
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
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Carte NBA disegnate dal server, in SVG, nello stile della serie da cui vengono: Donruss Optic
 * Downtown (la citta' dietro al giocatore), Prizm (il fondo a prismi), Topps Chrome (cornice cromata
 * e riflesso arcobaleno), Fleer 1986 (bordo bianco e bande colorate), Crown Royale Kaboom! (il
 * fumetto), Exquisite (legno scuro e oro). La parallela cambia la cornice (oro, argento, nera).
 * Nessun logo ufficiale: solo forme, colori e la foto del giocatore da cdn.nba.com, incorporata
 * come data URI (un SVG usato come immagine non puo' caricare risorse esterne).
 */
@RestController
@RequestMapping("/api")
public class NbaCardArtController {

    private static final int MAX_PHOTO_BYTES = 2 * 1024 * 1024;
    private static final int PHOTO_CACHE_SIZE = 200;
    private static final String PHOTO_HOST = "cdn.nba.com";

    /** Colori delle squadre (primario, secondario). */
    private static final Map<String, String[]> TEAMS = Map.ofEntries(
            Map.entry("Los Angeles Lakers", new String[]{"#552583", "#FDB927"}),
            Map.entry("Chicago Bulls", new String[]{"#CE1141", "#000000"}),
            Map.entry("Boston Celtics", new String[]{"#007A33", "#BA9653"}),
            Map.entry("Golden State Warriors", new String[]{"#1D428A", "#FFC72C"}),
            Map.entry("Milwaukee Bucks", new String[]{"#00471B", "#EEE1C6"}),
            Map.entry("Denver Nuggets", new String[]{"#0E2240", "#FEC524"}),
            Map.entry("Phoenix Suns", new String[]{"#1D1160", "#E56020"}),
            Map.entry("San Antonio Spurs", new String[]{"#000000", "#C4CED4"}),
            Map.entry("Philadelphia 76ers", new String[]{"#006BB6", "#ED174C"}),
            Map.entry("Minnesota Timberwolves", new String[]{"#0C2340", "#78BE20"}),
            Map.entry("Oklahoma City Thunder", new String[]{"#007AC1", "#EF3B24"}),
            Map.entry("Memphis Grizzlies", new String[]{"#5D76A9", "#12173F"}),
            Map.entry("New Orleans Pelicans", new String[]{"#0C2340", "#C8102E"}),
            Map.entry("LA Clippers", new String[]{"#C8102E", "#1D428A"}),
            Map.entry("Dallas Mavericks", new String[]{"#00538C", "#B8C4CA"}),
            Map.entry("Miami Heat", new String[]{"#98002E", "#F9A01B"}),
            Map.entry("Houston Rockets", new String[]{"#CE1141", "#C4CED4"}),
            Map.entry("Orlando Magic", new String[]{"#0077C0", "#C4CED4"}),
            Map.entry("Utah Jazz", new String[]{"#002B5C", "#F9A01B"}),
            Map.entry("Toronto Raptors", new String[]{"#CE1141", "#000000"}),
            Map.entry("New York Knicks", new String[]{"#006BB6", "#F58426"}),
            Map.entry("Detroit Pistons", new String[]{"#C8102E", "#1D42BA"}),
            Map.entry("Charlotte Hornets", new String[]{"#1D1160", "#00788C"}),
            Map.entry("Indiana Pacers", new String[]{"#002D62", "#FDBB30"}));

    private final CardRepository cardRepository;
    private final Map<String, String> photos = Collections.synchronizedMap(new LinkedHashMap<>(64, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, String> eldest) {
            return size() > PHOTO_CACHE_SIZE;
        }
    });
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    private final ActionPhotos actionPhotos;

    public NbaCardArtController(CardRepository cardRepository, ActionPhotos actionPhotos) {
        this.cardRepository = cardRepository;
        this.actionPhotos = actionPhotos;
    }

    /** id e' il code pubblico della carta, come in GET /api/cards/{id}. */
    @GetMapping(value = "/cards/{id}/nba-card.svg")
    public ResponseEntity<byte[]> card(@PathVariable String id) {
        Card card = cardRepository.findByCode(id)
                .filter(c -> NbaImporter.SOURCE.equals(c.getSource()))
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "card_not_found"));
        Map<String, Object> meta = card.getMetadata() == null ? Map.of() : card.getMetadata();
        String svg = NbaActionArt.isAction(meta)
                ? NbaActionArt.render(meta, actionPhotos.of(meta), photoOf(card), teamColors(meta)[0], NbaActionArt.credit(meta))
                : render(meta, photoOf(card));
        return ResponseEntity.ok()
                .contentType(MediaType.valueOf("image/svg+xml"))
                .cacheControl(CacheControl.maxAge(1, TimeUnit.DAYS).cachePublic())
                .body(svg.getBytes(StandardCharsets.UTF_8));
    }

    /** Foto del giocatore come data URI (rimpicciolita), scaricata una volta sola per giocatore. */
    private String photoOf(Card card) {
        Object url = card.getMetadata() == null ? null : card.getMetadata().get("photoUrl");
        if (!(url instanceof String photoUrl)) return null;
        URI uri;
        try {
            uri = URI.create(photoUrl);
        } catch (IllegalArgumentException ex) {
            return null;
        }
        if (!"https".equals(uri.getScheme()) || !PHOTO_HOST.equals(uri.getHost())) return null;
        String cached = photos.get(photoUrl);
        if (cached != null) return cached.isEmpty() ? null : cached;
        String dataUri = "";
        try {
            HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(10)).header("Accept", "image/*").GET().build();
            HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
            String type = response.headers().firstValue("Content-Type").orElse("");
            try (InputStream body = response.body()) {
                byte[] bytes = body.readNBytes(MAX_PHOTO_BYTES + 1);
                if (response.statusCode() == 200 && type.startsWith("image/") && bytes.length <= MAX_PHOTO_BYTES) {
                    byte[] small = FcCardArtController.shrink(bytes);
                    dataUri = small != null
                            ? "data:image/png;base64," + Base64.getEncoder().encodeToString(small)
                            : "data:" + type.split(";")[0] + ";base64," + Base64.getEncoder().encodeToString(bytes);
                }
            }
        } catch (Exception ex) {
            if (ex instanceof InterruptedException) Thread.currentThread().interrupt();
        }
        photos.put(photoUrl, dataUri);
        return dataUri.isEmpty() ? null : dataUri;
    }

    private static String[] teamColors(Map<String, Object> meta) {
        return TEAMS.getOrDefault(str(meta, "team"), new String[]{"#1f2937", "#f59e0b"});
    }

    private static String str(Map<String, Object> meta, String key) {
        Object value = meta.get(key);
        return value == null ? "" : String.valueOf(value);
    }

    private static String esc(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("'", "&#39;").replace("\"", "&quot;");
    }

    /** Cornice della parallela: colori del bordo (due tinte) e del testo sul bordo. */
    private static String[] frame(String parallel) {
        String p = parallel.toLowerCase();
        if (p.contains("gold")) return new String[]{"#fff1a8", "#c99a1e", "#3b2a06"};
        if (p.contains("black")) return new String[]{"#3a3a3a", "#050505", "#e9c46a"};
        if (p.contains("silver") || p.contains("holo") || p.contains("refractor")) return new String[]{"#ffffff", "#9aa3ad", "#1f2937"};
        return null;
    }

    /** La carta in SVG, 250x350 come le carte da collezione (63x88 mm). */
    public static String render(Map<String, Object> meta, String photo) {
        if (NbaActionArt.isAction(meta)) {
            return NbaActionArt.render(meta, null, photo, teamColors(meta)[0], NbaActionArt.credit(meta));
        }
        String player = str(meta, "player");
        String team = str(meta, "team");
        String brand = str(meta, "brand");
        String insert = str(meta, "insert");
        String parallel = str(meta, "parallel");
        String year = str(meta, "year");
        String number = str(meta, "number");
        boolean rookie = Boolean.TRUE.equals(meta.get("rookie"));
        Object serial = meta.get("serial");
        String[] colors = TEAMS.getOrDefault(team, new String[]{"#1f2937", "#f59e0b"});
        String primary = colors[0];
        String secondary = colors[1];
        String b = brand.toLowerCase();
        String ins = insert.toLowerCase();
        boolean vintage = year.length() >= 4 && Integer.parseInt(year.substring(0, 4)) < 1995;

        StringBuilder s = new StringBuilder();
        s.append("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 250 350' width='500' height='700'>");
        s.append("<defs>");
        s.append("<linearGradient id='team' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='").append(primary)
                .append("'/><stop offset='1' stop-color='").append(shade(primary)).append("'/></linearGradient>");
        s.append("<linearGradient id='rainbow' x1='0' y1='0' x2='1' y2='1'>")
                .append("<stop offset='0' stop-color='#ff9ad5' stop-opacity='.35'/><stop offset='.25' stop-color='#ffe27a' stop-opacity='.3'/>")
                .append("<stop offset='.5' stop-color='#8dffd9' stop-opacity='.3'/><stop offset='.75' stop-color='#8fd3ff' stop-opacity='.35'/>")
                .append("<stop offset='1' stop-color='#d9a2ff' stop-opacity='.35'/></linearGradient>");
        String[] fr = frame(parallel);
        if (fr != null) {
            s.append("<linearGradient id='frame' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='").append(fr[0])
                    .append("'/><stop offset='.5' stop-color='").append(fr[1]).append("'/><stop offset='1' stop-color='").append(fr[0])
                    .append("'/></linearGradient>");
        }
        s.append("<clipPath id='card'><rect width='250' height='350' rx='10'/></clipPath>");
        s.append("<clipPath id='art'><rect x='16' y='16' width='218' height='270' rx='6'/></clipPath>");
        s.append("</defs><g clip-path='url(#card)'>");

        // Fondo della serie.
        String frameFill = fr != null ? "url(#frame)" : vintage ? "#f5f1e6" : b.contains("exquisite") ? "#2b1b10" : "#111827";
        s.append("<rect width='250' height='350' fill='").append(frameFill).append("'/>");
        s.append("<g clip-path='url(#art)'>");
        if (ins.contains("downtown")) {
            // Downtown: la citta' al tramonto, la strada che sale, i palazzi del colore della squadra.
            s.append("<rect x='16' y='16' width='218' height='270' fill='#4c1d95'/>");
            s.append("<rect x='16' y='16' width='218' height='150' fill='#fb923c'/><rect x='16' y='16' width='218' height='70' fill='#fdba74'/>");
            s.append("<circle cx='190' cy='120' r='30' fill='#fde68a'/>");
            int[][] towers = {{20, 90, 26}, {48, 60, 22}, {72, 100, 30}, {104, 70, 20}, {126, 50, 28}, {156, 85, 24}, {182, 65, 30}, {212, 95, 22}};
            for (int[] t : towers) {
                s.append("<rect x='").append(t[0]).append("' y='").append(t[1]).append("' width='").append(t[2])
                        .append("' height='").append(200 - t[1]).append("' fill='").append(primary).append("' stroke='#1e1b4b' stroke-width='1.5'/>");
                for (int wy = t[1] + 8; wy < 190; wy += 12) {
                    s.append("<rect x='").append(t[0] + 5).append("' y='").append(wy).append("' width='").append(t[2] - 10)
                            .append("' height='4' fill='").append(secondary).append("' opacity='.7'/>");
                }
            }
            s.append("<path d='M16 286 C80 230 150 250 234 190 L234 286 Z' fill='#334155'/>");
            s.append("<path d='M30 286 C90 240 150 255 230 200' stroke='#facc15' stroke-width='3' stroke-dasharray='10 8' fill='none'/>");
            s.append("<rect x='70' y='26' width='110' height='20' rx='3' fill='#0f766e'/>");
            s.append("<text x='125' y='40' font-family='Arial' font-size='10' fill='#fff' text-anchor='middle'>").append(esc(cityOf(team))).append(" &#8599;</text>");
        } else if (ins.contains("kaboom")) {
            // Kaboom!: il fumetto con i raggi e la scritta che esplode.
            s.append("<rect x='16' y='16' width='218' height='270' fill='#fde047'/>");
            for (int i = 0; i < 18; i++) {
                double a = i * Math.PI / 9;
                s.append("<path d='M125 150 L").append(fmt(125 + Math.cos(a) * 260)).append(' ').append(fmt(150 + Math.sin(a) * 260))
                        .append(" L").append(fmt(125 + Math.cos(a + 0.12) * 260)).append(' ').append(fmt(150 + Math.sin(a + 0.12) * 260))
                        .append(" Z' fill='").append(i % 2 == 0 ? "#ef4444" : "#f97316").append("' opacity='.8'/>");
            }
            s.append("<text x='125' y='72' font-family='Impact, Arial Black' font-size='44' fill='#fff' stroke='#111' stroke-width='3' text-anchor='middle' transform='rotate(-8 125 72)'>KABOOM!</text>");
        } else if (b.contains("prizm")) {
            // Prizm: triangoli che rifrangono, nel colore della squadra.
            s.append("<rect x='16' y='16' width='218' height='270' fill='url(#team)'/>");
            for (int i = 0; i < 14; i++) {
                int x = 16 + (i * 37) % 218;
                int y = 16 + (i * 53) % 270;
                s.append("<path d='M").append(x).append(' ').append(y).append(" l60 30 l-40 50 Z' fill='#fff' opacity='").append(i % 3 == 0 ? ".14" : ".07").append("'/>");
            }
        } else if (b.contains("exquisite")) {
            s.append("<rect x='16' y='16' width='218' height='270' fill='#1c120a'/>");
            s.append("<rect x='160' y='200' width='60' height='60' rx='4' fill='").append(primary).append("' stroke='#d4af37' stroke-width='3'/>");
            s.append("<path d='M30 270 C60 240 90 290 130 255 S190 250 210 262' stroke='#e5e7eb' stroke-width='2.5' fill='none'/>");
        } else if (vintage) {
            // Vintage (Fleer 1986, Topps, Star): bande colorate e cornice crema.
            s.append("<rect x='16' y='16' width='218' height='270' fill='#e5e7eb'/>");
            s.append("<rect x='16' y='16' width='218' height='14' fill='#dc2626'/><rect x='16' y='30' width='218' height='8' fill='#1d4ed8'/>");
        } else {
            // Chrome, Optic, Select e le altre moderne: fondo della squadra con riflessi cromati.
            s.append("<rect x='16' y='16' width='218' height='270' fill='url(#team)'/>");
            s.append("<path d='M16 60 L234 16 L234 40 L16 84 Z' fill='#fff' opacity='.08'/>");
            s.append("<path d='M16 200 L234 150 L234 170 L16 220 Z' fill='#fff' opacity='.06'/>");
        }
        if (photo != null) {
            s.append("<image href='").append(photo).append("' x='-12' y='50' width='274' height='236' preserveAspectRatio='xMidYMax slice'/>");
        } else {
            s.append("<circle cx='125' cy='150' r='54' fill='#000' opacity='.25'/><text x='125' y='168' font-family='Arial Black' font-size='48' fill='#fff' text-anchor='middle'>")
                    .append(esc(player.isEmpty() ? "?" : player.substring(0, 1))).append("</text>");
        }
        if (parallel.toLowerCase().contains("holo") || parallel.toLowerCase().contains("refractor") || parallel.toLowerCase().contains("silver")) {
            s.append("<rect x='16' y='16' width='218' height='270' fill='url(#rainbow)'/>");
        }
        s.append("</g>");

        // Etichetta in basso: il nome (in corsivo per Downtown), squadra, serie.
        boolean light = vintage || fr != null && !parallel.toLowerCase().contains("black");
        String text = fr != null ? fr[2] : light ? "#111827" : "#f9fafb";
        if (ins.contains("downtown")) {
            s.append("<rect x='30' y='244' width='190' height='34' rx='4' fill='#0f766e' stroke='#99f6e4' stroke-width='1.5'/>");
            s.append("<text x='125' y='238' font-family='Brush Script MT, cursive' font-style='italic' font-size='30' fill='#5eead4' stroke='#064e3b' stroke-width='1' text-anchor='middle'>Downtown</text>");
            s.append("<text x='125' y='266' font-family='Georgia' font-size='13' fill='#fff' text-anchor='middle' letter-spacing='1'>").append(esc(player.toUpperCase())).append("</text>");
        }
        s.append("<text x='125' y='308' font-family='Arial Black, Arial' font-size='15' fill='").append(text).append("' text-anchor='middle'>")
                .append(esc(player.toUpperCase())).append("</text>");
        s.append("<text x='125' y='324' font-family='Arial' font-size='9' fill='").append(text).append("' text-anchor='middle' opacity='.85'>")
                .append(esc(team.toUpperCase())).append("</text>");
        s.append("<text x='125' y='340' font-family='Arial' font-size='8' fill='").append(text).append("' text-anchor='middle' opacity='.7'>")
                .append(esc(year + " " + brand + (insert.isEmpty() ? "" : " · " + insert) + (parallel.isEmpty() ? "" : " · " + parallel) + " · #" + number)).append("</text>");
        if (rookie) {
            s.append("<g transform='translate(194 24)'><rect width='34' height='22' rx='4' fill='#dc2626' stroke='#fff' stroke-width='1.5'/>")
                    .append("<text x='17' y='16' font-family='Arial Black' font-size='12' fill='#fff' text-anchor='middle'>RC</text></g>");
        }
        if (serial != null) {
            String label = "1".equals(String.valueOf(serial)) ? "1/1" : "/" + serial;
            s.append("<g transform='translate(22 24)'><rect width='40' height='18' rx='4' fill='#111' opacity='.8'/>")
                    .append("<text x='20' y='13' font-family='Arial' font-weight='bold' font-size='10' fill='#fde047' text-anchor='middle'>").append(label).append("</text></g>");
        }
        s.append("</g><rect x='1' y='1' width='248' height='348' rx='10' fill='none' stroke='#000' stroke-opacity='.4' stroke-width='2'/></svg>");
        return s.toString();
    }

    private static String fmt(double v) {
        return String.valueOf(Math.round(v * 10) / 10.0);
    }

    /** Colore piu' scuro per il fondo sfumato. */
    private static String shade(String hex) {
        int rgb = Integer.parseInt(hex.substring(1), 16);
        int r = (int) (((rgb >> 16) & 0xff) * 0.55);
        int g = (int) (((rgb >> 8) & 0xff) * 0.55);
        int bl = (int) ((rgb & 0xff) * 0.55);
        return String.format("#%02x%02x%02x", r, g, bl);
    }

    /** Citta' della squadra, per il cartello stradale delle Downtown. */
    private static String cityOf(String team) {
        if (team.startsWith("Los Angeles") || team.startsWith("LA ")) return "Los Angeles";
        if (team.startsWith("Golden State")) return "San Francisco";
        if (team.startsWith("New York")) return "New York";
        if (team.startsWith("San Antonio")) return "San Antonio";
        if (team.startsWith("Oklahoma City")) return "Oklahoma City";
        if (team.startsWith("New Orleans")) return "New Orleans";
        int space = team.lastIndexOf(' ');
        return space > 0 ? team.substring(0, space) : team;
    }
}
