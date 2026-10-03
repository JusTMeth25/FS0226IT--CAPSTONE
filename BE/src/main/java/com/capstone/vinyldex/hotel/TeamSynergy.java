package com.capstone.vinyldex.hotel;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

/**
 * Bonus di squadra delle sfide nell'hotel: le stesse regole della pagina Battaglie
 * (frontend/src/utils/battleSynergy.js), calcolate dal server che decide chi vince.
 *
 * - Stessa classe (carte VinylDex): +6% in 2, +12% in 3.
 * - Stessa tipologia (tipo Pokemon, colore Magic, squadra NBA...): +5% in 2, +10% in 3.
 * - Stesso set: +4% in 2, +8% in 3.
 * - Tutte dello stesso gioco: +5%.
 * - Squadra di carte speciali (con finitura olografica): +5%.
 * Per carta al massimo +25%, su tutte le statistiche.
 */
final class TeamSynergy {

    private TeamSynergy() {
    }

    static final int CAP = 25;

    /** Un bonus attivo: etichetta, icona, percentuale e posizioni delle carte che lo prendono. */
    record Bonus(String key, String label, String icon, int value, List<Integer> members) {
    }

    /** Squadra con le statistiche gia' aumentate e l'elenco dei bonus (per mostrarli). */
    record Result(List<PvpGame.CardInfo> team, List<Bonus> bonuses) {
    }

    private static String game(PvpGame.CardInfo card) {
        String source = card.source() == null ? "original" : card.source();
        return source.startsWith("pokemon") ? "pokemon" : source;
    }

    private interface Key {
        String of(PvpGame.CardInfo card);
    }

    private static void groups(List<PvpGame.CardInfo> team, Key key, GroupFound found) {
        Map<String, List<Integer>> groups = new LinkedHashMap<>();
        for (int i = 0; i < team.size(); i++) {
            String value = key.of(team.get(i));
            if (value == null || value.isBlank()) continue;
            groups.computeIfAbsent(value, k -> new ArrayList<>()).add(i);
        }
        groups.forEach((value, members) -> {
            if (members.size() >= 2) found.add(value, members);
        });
    }

    private interface GroupFound {
        void add(String value, List<Integer> members);
    }

    static List<Bonus> bonuses(List<PvpGame.CardInfo> team) {
        List<Bonus> bonuses = new ArrayList<>();
        groups(team, PvpGame.CardInfo::artistClass, (name, m) ->
                bonuses.add(new Bonus("class-" + name, "Stessa classe: " + name, "ph-users-three", m.size() >= 3 ? 12 : 6, m)));
        groups(team, PvpGame.CardInfo::kind, (name, m) ->
                bonuses.add(new Bonus("kind-" + name, "Stessa tipologia: " + name, "ph-shapes", m.size() >= 3 ? 10 : 5, m)));
        groups(team, c -> c.setName() == null ? null : game(c) + "|" + c.setName(), (key, m) ->
                bonuses.add(new Bonus("set-" + key, "Stesso set: " + key.substring(key.indexOf('|') + 1), "ph-stack", m.size() >= 3 ? 8 : 4, m)));
        List<Integer> all = IntStream.range(0, team.size()).boxed().toList();
        if (team.size() == PvpGame.TEAM_SIZE && team.stream().map(TeamSynergy::game).distinct().count() == 1) {
            bonuses.add(new Bonus("game", "Tutte dello stesso gioco", "ph-cards", 5, all));
        }
        if (team.size() == PvpGame.TEAM_SIZE && team.stream().allMatch(c -> c.finish() != null)) {
            bonuses.add(new Bonus("special", "Squadra di carte speciali", "ph-sparkle", 5, all));
        }
        return bonuses;
    }

    static Result apply(List<PvpGame.CardInfo> team) {
        List<Bonus> bonuses = bonuses(team);
        List<PvpGame.CardInfo> boosted = new ArrayList<>();
        for (int i = 0; i < team.size(); i++) {
            final int index = i;
            int percent = Math.min(CAP, bonuses.stream().filter(b -> b.members().contains(index)).mapToInt(Bonus::value).sum());
            PvpGame.CardInfo card = team.get(i);
            if (percent == 0) {
                boosted.add(card);
                continue;
            }
            Map<String, Integer> stats = new HashMap<>();
            card.stats().forEach((k, v) -> stats.put(k, (int) Math.round(v * (1 + percent / 100.0))));
            boosted.add(card.withStats(stats, percent));
        }
        return new Result(List.copyOf(boosted), List.copyOf(bonuses));
    }
}
