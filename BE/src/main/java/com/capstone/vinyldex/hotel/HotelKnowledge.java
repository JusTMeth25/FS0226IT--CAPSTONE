package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Pack;
import com.capstone.vinyldex.entity.PackDropRate;
import com.capstone.vinyldex.repository.PackRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Cosa sanno gli NPC del gioco: regole vere, lette dal codice e dal database, da mettere nel
 * prompt del modello linguistico. Senza, il modello inventa ("pacchetti premium", "eventi
 * speciali") e da' consigli sbagliati.
 *
 * I pacchetti attivi con prezzi e probabilita' vengono letti dal database e tenuti per cinque
 * minuti: se un admin ne aggiunge uno, gli NPC lo scoprono presto.
 */
@Component
public class HotelKnowledge implements Supplier<String> {

    private static final long CACHE_MILLIS = 5 * 60_000;
    private static final Map<String, String> RARITY_NAMES = Map.of(
            "common", "comune", "uncommon", "non comune", "rare", "rara", "epic", "epica", "legendary", "leggendaria");

    private final PackRepository packRepository;
    private String cached;
    private long cachedAt;

    public HotelKnowledge(PackRepository packRepository) {
        this.packRepository = packRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public synchronized String get() {
        long now = System.currentTimeMillis();
        if (cached == null || now - cachedAt > CACHE_MILLIS) {
            cached = build();
            cachedAt = now;
        }
        return cached;
    }

    private String build() {
        StringBuilder s = new StringBuilder("""
                Regole vere di VinylDex (non inventarne altre):
                - Le carte hanno cinque rarita': comune, non comune, rara, epica, leggendaria (la piu' difficile).
                - Le carte arrivano aprendo pacchetti, dagli scambi con altri giocatori e dal mercato.
                - Gold si guadagna: accesso giornaliero (10 gold piu' 2 per ogni giorno di fila), missioni, battaglie \
                contro il computer, sfide in Arena (vittoria 80 gold, al massimo 5 sfide premiate al giorno), vendendo \
                carte al mercato, salendo di livello e completando gli album.
                - Nell'hotel: rispetto (3 al giorno da dare ad altri giocatori), stanza personale da arredare con i \
                mobili del negozio pagati in gold, vetrine per esporre le carte, sfide PvP cliccando un giocatore.
                - In Edicola (stanza pubblica dell'hotel) si comprano i pacchetti allo stesso prezzo del sito: vanno \
                nella borsa e si aprono da li', con la stessa apertura della pagina Pacchetti.
                """);
        List<Pack> packs = packRepository.findAllActiveWithRates().stream()
                .sorted(Comparator.comparingInt(Pack::getPriceGold))
                .toList();
        if (!packs.isEmpty()) {
            s.append("- Pacchetti in vendita ora:\n");
            for (Pack pack : packs) {
                s.append("  * ").append(pack.getName()).append(": ").append(pack.getCardCount()).append(" carte, ");
                if (pack.isFree()) {
                    s.append("gratis ogni ").append(pack.getFreeCooldownHours()).append(" ore");
                } else {
                    s.append(pack.getPriceGold()).append(" gold");
                }
                String odds = odds(pack);
                if (!odds.isEmpty()) s.append("; probabilita' per carta: ").append(odds);
                s.append('\n');
            }
        }
        return s.toString();
    }

    private static String odds(Pack pack) {
        double total = pack.getDropRates().stream().mapToDouble(PackDropRate::getWeight).sum();
        if (total <= 0) return "";
        return String.join(", ", pack.getDropRates().stream()
                .sorted(Comparator.comparingDouble(PackDropRate::getWeight).reversed())
                .map(r -> RARITY_NAMES.getOrDefault(r.getRarity(), r.getRarity()) + " "
                        + String.format(Locale.ITALY, "%.1f%%", r.getWeight() * 100 / total))
                .toList());
    }
}
