package com.capstone.vinyldex.controller;

import java.util.Locale;
import java.util.Map;
import java.util.Random;

/**
 * Carte NBA "Action": un omaggio alle carte da basket degli anni '80 (fondo rosso, bande bianche e
 * blu sui lati, cornice gialla arrotondata, targa azzurra con nome, squadra e ruolo) con una foto
 * vera del giocatore in azione.
 *
 * Le foto vengono da Wikimedia Commons, solo con licenza libera (pubblico dominio, CC BY, CC BY-SA):
 * autore e licenza sono scritti sulla carta e nella pagina della carta, come le licenze chiedono.
 * La foto si muove piano (zoom lento e un riflesso che passa): l'animazione e' SMIL dentro l'SVG,
 * funziona anche quando la carta e' un'immagine, e il primo fotogramma e' la foto intera.
 * Nessun logo dei produttori di carte: il marchio sulla carta e' VinylDex.
 */
final class NbaActionArt {

    private NbaActionArt() {
    }

    /** Foto pronta per la carta: data URI, dimensioni e punto da tenere al centro (0-1). */
    record Photo(String dataUri, int width, int height, double focusX, double focusY, double zoom) {
    }

    /** Carte con la foto in azione: le Action e la Fleer d'epoca (anni '80). */
    static boolean isAction(Map<String, Object> meta) {
        String insert = text(meta, "insert").toLowerCase(Locale.ROOT);
        String brand = text(meta, "brand").toLowerCase(Locale.ROOT);
        String year = text(meta, "year");
        boolean vintage = year.length() >= 4 && year.substring(0, 4).compareTo("1995") < 0;
        return insert.equals("action") || (brand.contains("fleer") && vintage);
    }

    /** Riga dei crediti della foto: autore e licenza, come chiedono le licenze libere. */
    @SuppressWarnings("unchecked")
    static String credit(Map<String, Object> meta) {
        if (!(meta.get("actionPhoto") instanceof Map<?, ?> raw)) return null;
        Map<String, Object> info = (Map<String, Object>) raw;
        String artist = text(info, "artist");
        String license = text(info, "license");
        if (artist.length() > 48) artist = artist.substring(0, 47) + "…";
        String source = text(info, "source");
        return "Foto: " + (artist.isBlank() ? "autore sconosciuto" : artist) + " · " + license + " · "
                + (source.isBlank() ? "Wikimedia Commons" : source);
    }

    /** Finestra della foto dentro la cornice gialla. */
    private static final double PX = 26, PY = 24, PW = 198, PH = 262;

    static String render(Map<String, Object> meta, Photo action, String headshot, String primary, String credit) {
        String player = text(meta, "player");
        String team = text(meta, "team");
        String year = text(meta, "year");
        String number = text(meta, "number");
        String position = switch (text(meta, "position")) {
            case "G" -> "GUARD";
            case "F" -> "FORWARD";
            case "C" -> "CENTER";
            default -> text(meta, "position").toUpperCase(Locale.ROOT);
        };
        boolean rookie = Boolean.TRUE.equals(meta.get("rookie"));

        StringBuilder s = new StringBuilder(action != null ? action.dataUri().length() + 8_000 : 60_000);
        s.append("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 250 350' width='500' height='700'>");
        s.append("<defs>");
        s.append("<clipPath id='card'><rect width='250' height='350' rx='10'/></clipPath>");
        s.append("<clipPath id='photo'><rect x='26' y='24' width='198' height='262' rx='10'/></clipPath>");
        s.append("<linearGradient id='arena' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#141827'/>")
                .append("<stop offset='1' stop-color='#2c3047'/></linearGradient>");
        s.append("<linearGradient id='shine' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#fff' stop-opacity='0'/>")
                .append("<stop offset='.5' stop-color='#fff' stop-opacity='.22'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient>");
        s.append("</defs><g clip-path='url(#card)'>");

        // Cornice: fondo rosso, bande blu e bianche sui lati, cornice gialla.
        s.append("<rect width='250' height='350' fill='#d7262d'/>");
        s.append("<rect y='112' width='250' height='42' fill='#1f5fbf'/><rect y='154' width='250' height='44' fill='#fff'/>");
        s.append("<rect y='198' width='250' height='42' fill='#1f5fbf'/>");
        s.append("<rect x='19' y='17' width='212' height='314' rx='17' fill='#f4c22b'/>");

        s.append("<g clip-path='url(#photo)'>");
        s.append("<rect x='26' y='24' width='198' height='262' fill='url(#arena)'/>");
        if (action != null) {
            photo(s, action);
        } else {
            // Senza foto in azione: il pubblico e la foto ufficiale del giocatore.
            crowd(s, player, primary);
            if (headshot != null) {
                s.append("<image href='").append(headshot).append("' x='-14' y='96' width='278' height='203' preserveAspectRatio='xMidYMax slice'/>");
            }
        }
        // Riflesso che attraversa la foto, come sulla carta lucida.
        s.append("<rect x='-90' y='0' width='70' height='350' fill='url(#shine)' transform='skewX(-18)'>")
                .append("<animate attributeName='x' values='-90;-90;300' keyTimes='0;0.6;1' dur='6s' repeatCount='indefinite'/></rect>");
        badge(s);
        if (rookie) {
            s.append("<g transform='translate(32 30)'><rect width='30' height='18' rx='4' fill='#d7262d' stroke='#fff' stroke-width='1.5'/>")
                    .append("<text x='15' y='13' font-family='Arial Black, Arial' font-size='10' fill='#fff' text-anchor='middle'>RC</text></g>");
        }
        s.append("</g>");

        // Targa con nome, squadra e ruolo.
        s.append("<rect x='26' y='289' width='198' height='36' rx='9' fill='#5fb8e6'/>");
        // I nomi lunghi (Antetokounmpo, Gilgeous-Alexander) si stringono per restare nella targa.
        double nameSize = Math.min(14, 182 / Math.max(1, player.length() * 0.74));
        s.append("<text x='125' y='306' font-family='Arial Black, Arial' font-weight='900' font-size='").append(fmt(nameSize))
                .append("' fill='#fff' text-anchor='middle' letter-spacing='.5'>")
                .append(esc(player.toUpperCase(Locale.ROOT))).append("</text>");
        s.append("<text x='125' y='319' font-family='Arial' font-weight='700' font-size='8.5' fill='#fff' text-anchor='middle'>")
                .append(esc(teamName(team).toUpperCase(Locale.ROOT))).append(" • ").append(esc(position)).append("</text>");
        s.append("<text x='125' y='339' font-family='Arial' font-weight='700' font-size='7' fill='#fff' fill-opacity='.9' text-anchor='middle'>")
                .append(esc("VINYLDEX HOOPS • " + year + (number.isEmpty() ? "" : " • #" + number))).append("</text>");
        if (credit != null && !credit.isBlank()) {
            s.append("<text x='125' y='346.5' font-family='Arial' font-size='4.6' fill='#fff' fill-opacity='.8' text-anchor='middle'>")
                    .append(esc(credit)).append("</text>");
        }
        s.append("</g><rect x='1' y='1' width='248' height='348' rx='10' fill='none' stroke='#000' stroke-opacity='.35' stroke-width='2'/></svg>");
        return s.toString();
    }

    /**
     * La foto riempie la finestra tenendo al centro il giocatore (focus), e si avvicina piano
     * verso di lui e torna indietro.
     */
    private static void photo(StringBuilder s, Photo p) {
        // Zoom > 1: foto prese da lontano, si ingrandisce il giocatore.
        double scale = Math.max(PW / p.width(), PH / p.height()) * Math.max(1, p.zoom());
        double w = p.width() * scale;
        double h = p.height() * scale;
        double x = clamp(PX + PW / 2 - p.focusX() * w, PX + PW - w, PX);
        double y = clamp(PY + PH / 2 - p.focusY() * h, PY + PH - h, PY);
        double cx = x + p.focusX() * w;
        double cy = y + p.focusY() * h;
        s.append("<g transform='translate(").append(fmt(cx)).append(' ').append(fmt(cy)).append(")'><g>")
                .append("<animateTransform attributeName='transform' type='scale' values='1;1.09;1' keyTimes='0;0.5;1' ")
                .append("calcMode='spline' keySplines='.45 0 .55 1;.45 0 .55 1' dur='10s' repeatCount='indefinite'/>")
                .append("<image href='").append(p.dataUri()).append("' x='").append(fmt(x - cx)).append("' y='").append(fmt(y - cy))
                .append("' width='").append(fmt(w)).append("' height='").append(fmt(h)).append("' preserveAspectRatio='none'/>")
                .append("</g></g>");
    }

    /** Il pubblico sugli spalti (solo senza foto in azione). */
    private static void crowd(StringBuilder s, String seed, String teamColor) {
        String[] palette = {"#2b2f45", "#3d3450", "#24394a", "#4b4038", "#36412e", "#584c42", "#3c4256", "#655a50", teamColor};
        Random random = new Random(seed.hashCode());
        s.append("<g opacity='.55'>");
        for (int y = 32; y < 244; y += 7) {
            for (int x = 28; x < 224; x += 7) {
                s.append("<circle cx='").append(fmt(x + random.nextDouble() * 3)).append("' cy='").append(fmt(y + random.nextDouble() * 2))
                        .append("' r='2.7' fill='").append(palette[random.nextInt(palette.length)]).append("'/>");
            }
        }
        s.append("</g>");
    }

    /** Il marchio in alto a destra, al posto del logo del produttore. */
    private static void badge(StringBuilder s) {
        s.append("<g transform='translate(160 32)'>")
                .append("<polygon points='0,0 58,0 52,13 58,26 0,26 6,13' fill='#d7262d' stroke='#fff' stroke-width='1.2'/>")
                .append("<text x='29' y='12' font-family='Arial Black, Arial' font-weight='900' font-size='8' fill='#fff' text-anchor='middle'>VINYLDEX</text>")
                .append("<rect x='9' y='15' width='40' height='8' rx='2' fill='#f4c22b'/>")
                .append("<text x='29' y='21.5' font-family='Arial' font-weight='700' font-size='6' fill='#7a1a14' text-anchor='middle' letter-spacing='1.5'>HOOPS</text>")
                .append("</g>");
    }

    /** "Los Angeles Lakers" -> "Lakers", come sulle carte d'epoca. */
    private static String teamName(String team) {
        if (team.endsWith("Trail Blazers")) return "Trail Blazers";
        int space = team.lastIndexOf(' ');
        return space > 0 ? team.substring(space + 1) : team;
    }

    private static double clamp(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }

    private static String fmt(double v) {
        return String.valueOf(Math.round(v * 10) / 10.0);
    }

    private static String text(Map<String, Object> meta, String key) {
        Object value = meta.get(key);
        return value == null ? "" : String.valueOf(value);
    }

    private static String esc(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("'", "&#39;").replace("\"", "&quot;");
    }
}
