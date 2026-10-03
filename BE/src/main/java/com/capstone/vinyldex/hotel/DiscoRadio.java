package com.capstone.vinyldex.hotel;

import org.springframework.core.io.ClassPathResource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * La musica vera della Disco: i set dei DJ (resources/music/djs.json, preparato da
 * BE/scripts/disco_djs.py) con le anteprime ufficiali di 30 secondi di Apple Music (iTunes Search
 * API). Ogni DJ e' un personaggio ispirato a un DJ vero e suona i brani dell'artista a cui e'
 * ispirato; finito il suo set alla consolle sale il DJ successivo.
 *
 * Il server decide brano e momento d'inizio, ogni client suona l'anteprima dal punto giusto: tutti
 * nella stanza sentono lo stesso pezzo nello stesso momento.
 */
final class DiscoRadio {

    private DiscoRadio() {
    }

    /**
     * Quanto suona ogni brano: le anteprime di Apple Music durano 30 secondi, il brano dopo parte
     * un po' prima della fine cosi' i client fanno la dissolvenza incrociata sulla coda del vecchio.
     */
    static final long TRACK_MILLIS = 27_000;
    /** Indice del jukebox che vuol dire "radio della Disco" (i brani sintetizzati sono 0-9). */
    static final int RADIO_TRACK = 100;

    record Track(long id, String title, String artist, String preview, String artwork, String url) {
    }

    /** altLook (facoltativo): il secondo aspetto, per i duo che si danno il cambio un brano a testa. */
    record Dj(String key, String name, String tribute, String look, String altLook, List<Track> tracks) {
    }

    static final List<Dj> DJS = load();

    private static List<Dj> load() {
        var resource = new ClassPathResource("music/djs.json");
        if (!resource.exists()) return List.of();
        try (InputStream in = resource.getInputStream()) {
            List<Dj> djs = new ArrayList<>();
            for (JsonNode node : JsonMapper.builder().build().readTree(in)) {
                List<Track> tracks = new ArrayList<>();
                for (JsonNode t : node.path("tracks")) {
                    tracks.add(new Track(t.path("id").asLong(), t.path("title").asString(), t.path("artist").asString(),
                            t.path("preview").asString(), t.path("artwork").asString(), t.path("url").asString()));
                }
                if (!tracks.isEmpty()) {
                    djs.add(new Dj(node.path("key").asString(), node.path("name").asString(), node.path("tribute").asString(),
                            node.path("look").asString(), node.path("altLook").asString(null), List.copyOf(tracks)));
                }
            }
            return List.copyOf(djs);
        } catch (Exception ex) {
            return List.of();
        }
    }

    /** A che punto e' la radio: DJ, brano e quando e' partito. */
    static final class State {
        int dj;
        int track;
        long startedAt;

        State(long now) {
            this.startedAt = now;
        }

        Dj currentDj() {
            return DJS.get(dj);
        }

        Track current() {
            return currentDj().tracks().get(track);
        }

        /** Aspetto del DJ alla consolle in questo brano. */
        String look() {
            Dj d = currentDj();
            return d.altLook() != null && track % 2 == 1 ? d.altLook() : d.look();
        }

        /** Passa al brano successivo; finito il set tocca al DJ dopo. true se cambia chi e' alla consolle. */
        boolean next(long now) {
            startedAt = now;
            track++;
            if (track < currentDj().tracks().size()) return currentDj().altLook() != null;
            track = 0;
            dj = (dj + 1) % DJS.size();
            return true;
        }

        /** Avanza da solo quando l'anteprima e' finita. */
        boolean due(long now) {
            return now - startedAt >= TRACK_MILLIS;
        }

        /** Il brano che suonera' dopo (il primo del DJ successivo a fine set). */
        Track upcoming() {
            List<Track> tracks = currentDj().tracks();
            return track + 1 < tracks.size() ? tracks.get(track + 1) : DJS.get((dj + 1) % DJS.size()).tracks().get(0);
        }

        Map<String, Object> view() {
            Dj d = currentDj();
            Track t = current();
            Map<String, Object> view = new LinkedHashMap<>();
            view.put("dj", d.name());
            view.put("tribute", d.tribute());
            view.put("title", t.title());
            view.put("artist", t.artist());
            view.put("preview", t.preview());
            view.put("artwork", t.artwork());
            view.put("url", t.url());
            view.put("trackId", t.id());
            view.put("startedAt", startedAt);
            view.put("next", d.tracks().size() - track - 1);
            // Il client lo carica in anticipo, cosi' il cambio brano e' senza attese.
            view.put("nextPreview", upcoming().preview());
            return view;
        }
    }
}
