package com.capstone.vinyldex.dto.response;

import com.capstone.vinyldex.entity.Card;

import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Finitura olografica di una carta, come nelle carte Pokemon da collezione: il frontend la
 * disegna in CSS (riflessi che seguono il puntatore, holo-finish.css) solo per le carte speciali.
 *
 * Carte Pokemon, dalla rarita' della fonte e dal nome:
 * <ul>
 *   <li>reverse: la versione olografica di una carta normale (foil fuori dall'illustrazione);</li>
 *   <li>holo: Holo Rare classiche, LV.X, Prime, BREAK, Prism Star (foil nell'illustrazione);</li>
 *   <li>cosmos: promo Black Star, con il foil "galassia";</li>
 *   <li>amazing, radiant: Amazing Rare e Radiant Rare;</li>
 *   <li>ultra: V, EX, GX, ex, Double Rare (fasce diagonali);</li>
 *   <li>vmax, vstar: VMAX e VSTAR;</li>
 *   <li>vfull: Full Art (Ultra Rare), Pokemon e Allenatori;</li>
 *   <li>rainbow: Rainbow Rare;</li>
 *   <li>secret: Secret e Hyper Rare dorate;</li>
 *   <li>shiny: Shiny Vault e Shiny Rare (argento a scaglie);</li>
 *   <li>gallery: Trainer Gallery;</li>
 *   <li>illustration: Illustration, Special Illustration e Art Rare.</li>
 * </ul>
 * Le carte Pokemon giapponesi non hanno finitura (impaginazioni diverse da quelle occidentali).
 * Le altre carte: illustration per le leggendarie VinylDex, secret per le leggendarie degli altri
 * giochi, ultra per le epiche, holo per le stampe foil. null per le carte normali.
 */
public final class CardFinish {

    private CardFinish() {
    }

    private static final Pattern SECRET = Pattern.compile("secret|hyper|gold|ultimate|crown|\\bur\\b|black");
    private static final Pattern ILLUSTRATION = Pattern.compile("illustration|art rare|\\bsar\\b|\\bar\\b");
    private static final Pattern ULTRA = Pattern.compile("ultra|double rare|super rare|\\brr\\b|full art|ace spec|prism");
    private static final Pattern HOLO = Pattern.compile("holo|foil|parallel|reverse|refractor|silver");

    public static String of(Card card) {
        String source = card.getSource() == null ? "" : card.getSource();
        String rarity = card.getRarity() == null ? "" : card.getRarity();
        String finish;
        if ("pokemonjp".equals(source)) {
            // Carte giapponesi: impaginazioni diverse per ogni epoca, il riquadro delle finiture non
            // combacia. Restano con il riflesso generico per rarita' (come prima delle finiture).
            return null;
        } else if (source.startsWith("pokemon")) {
            finish = pokemon(card, rarity);
        } else if ("original".equals(source)) {
            finish = switch (rarity) {
                case "legendary" -> "illustration";
                case "epic" -> "ultra";
                default -> null;
            };
        } else {
            String tcg = tcgRarity(card);
            if ("legendary".equals(rarity) || SECRET.matcher(tcg).find()) finish = "secret";
            else if (tcg.contains("rainbow")) finish = "rainbow";
            else if (ILLUSTRATION.matcher(tcg).find()) finish = "illustration";
            else if ("epic".equals(rarity) || ULTRA.matcher(tcg).find()) finish = "ultra";
            else if (HOLO.matcher(tcg).find()) finish = "holo";
            else finish = null;
        }
        // La versione olografica di una carta normale e' una "reverse holo".
        if (finish == null && card.isHolo()) finish = source.startsWith("pokemon") ? "reverse" : "holo";
        return finish;
    }

    private static String pokemon(Card card, String rarity) {
        String tcg = tcgRarity(card);
        String name = card.getName() == null ? "" : card.getName();
        String set = card.getSetCode() == null ? "" : card.getSetCode().toLowerCase(Locale.ROOT);
        boolean vmax = name.matches("(?i).*\\bvmax\\b.*") || tcg.contains("vmax");
        boolean vstar = name.matches("(?i).*\\bvstar\\b.*") || tcg.contains("vstar");
        if (tcg.contains("trainer gallery") || set.endsWith("tg") || set.endsWith("gg")) return "gallery";
        if (tcg.contains("shiny") || set.endsWith("sv")) return "shiny";
        if (tcg.contains("rainbow")) return "rainbow";
        if (SECRET.matcher(tcg).find()) return "secret";
        if (ILLUSTRATION.matcher(tcg).find()) return "illustration";
        if (tcg.contains("amazing")) return "amazing";
        if (tcg.contains("radiant")) return "radiant";
        if (vmax) return "vmax";
        if (vstar) return "vstar";
        if (tcg.contains("rare ultra") || tcg.equals("ultra rare")) return "vfull";
        if (ULTRA.matcher(tcg).find() || tcg.matches(".*holo (ex|v|gx|lv\\.x).*")
                || name.matches("(?i).*[ -](ex|gx|v)\\b.*")) return "ultra";
        if (tcg.equals("promo")) return "cosmos";
        if (HOLO.matcher(tcg).find() || tcg.matches(".*(prime|break|legend|star|shining|ace).*")) return "holo";
        // Rarita' della fonte presente ma semplice (Common, Rare...): nessuna finitura, anche se la
        // carta vale tanto. Solo senza rarita' della fonte decide il valore.
        if (!tcg.isEmpty() && !tcg.equals("none")) return null;
        return switch (rarity) {
            case "legendary" -> "secret";
            case "epic" -> "ultra";
            default -> null;
        };
    }

    /** Rarita' della fonte (e parallela delle carte sportive), in minuscolo. */
    private static String tcgRarity(Card card) {
        Map<String, Object> meta = card.getMetadata();
        StringBuilder text = new StringBuilder();
        if (meta != null) {
            if (meta.get("tcgRarity") != null) text.append(meta.get("tcgRarity"));
            if (meta.get("parallel") != null) text.append(' ').append(meta.get("parallel"));
        }
        return text.toString().toLowerCase(Locale.ROOT).trim();
    }
}
