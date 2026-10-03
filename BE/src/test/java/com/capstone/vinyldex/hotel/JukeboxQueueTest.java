package com.capstone.vinyldex.hotel;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JukeboxQueueTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String PREVIEW = "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview/a/b/c.plus.aac.p.m4a";

    private static JsonNode track(String json) {
        return JSON.readTree(json);
    }

    @Test
    void acceptsAppleAndSpotifySongsAndDropsForeignLinks() {
        UUID me = UUID.randomUUID();
        JukeboxQueue.Song apple = JukeboxQueue.parse(track("{\"title\":\"Juicy\",\"artist\":\"The Notorious B.I.G.\",\"preview\":\"" + PREVIEW
                + "\",\"artwork\":\"https://evil.example.com/x.jpg\"}"), me, "io");
        assertNotNull(apple);
        assertNull(apple.artwork());
        assertEquals(JukeboxQueue.PREVIEW_MILLIS, apple.playMillis());

        JukeboxQueue.Song spotify = JukeboxQueue.parse(track("{\"title\":\"Adorn\",\"artist\":\"Miguel\",\"spotifyUri\":\"spotify:track:"
                + "4kbj5MwxO1bq9wjT5g9HaA\",\"durationMs\":193000}"), me, "io");
        assertNotNull(spotify);
        assertEquals(193_000, spotify.playMillis());

        assertNull(JukeboxQueue.parse(track("{\"title\":\"X\",\"artist\":\"Y\",\"preview\":\"https://evil.example.com/a.m4a\"}"), me, "io"));
        assertNull(JukeboxQueue.parse(track("{\"title\":\"\",\"artist\":\"Y\",\"preview\":\"" + PREVIEW + "\"}"), me, "io"));
    }

    @Test
    void limitsSongsPerPersonAndPlaysThemInOrder() {
        JukeboxQueue queue = new JukeboxQueue();
        UUID me = UUID.randomUUID();
        for (int i = 0; i < JukeboxQueue.MAX_PER_USER; i++) {
            assertNull(queue.add(JukeboxQueue.parse(track("{\"title\":\"Song " + i + "\",\"artist\":\"A\",\"preview\":\"" + PREVIEW + "\"}"), me, "io")));
        }
        assertEquals("jukebox_queue_mine", queue.add(JukeboxQueue.parse(track("{\"title\":\"Altra\",\"artist\":\"A\",\"preview\":\"" + PREVIEW + "\"}"), me, "io")));

        assertTrue(queue.advance(1_000));
        assertEquals("Song 0", queue.current().title());
        assertFalse(queue.due(1_000 + JukeboxQueue.PREVIEW_MILLIS - 1));
        assertTrue(queue.due(1_000 + JukeboxQueue.PREVIEW_MILLIS));
        assertEquals(JukeboxQueue.MAX_PER_USER - 1, queue.upcoming().size());
    }

    @Test
    void stationPlaysWhenQueueIsEmptyAndHandPickedSongsGoFirst() {
        JukeboxQueue queue = new JukeboxQueue();
        UUID me = UUID.randomUUID();
        java.util.List<JukeboxQueue.Song> radio = new java.util.ArrayList<>();
        for (int i = 0; i < 3; i++) {
            radio.add(JukeboxQueue.parse(track("{\"title\":\"Radio " + i + "\",\"artist\":\"Skrillex\",\"spotifyUri\":\"spotify:track:"
                    + "4kbj5MwxO1bq9wjT5g9HaA\",\"durationMs\":200000}"), me, "io"));
        }
        assertNull(queue.setStation("Radio Skrillex", radio, me, "io"));
        assertNull(queue.add(JukeboxQueue.parse(track("{\"title\":\"Scelta\",\"artist\":\"A\",\"preview\":\"" + PREVIEW + "\"}"), me, "io")));

        assertTrue(queue.advance(0));
        assertEquals("Scelta", queue.current().title());
        assertTrue(queue.advance(1));
        assertEquals("Radio 0", queue.current().title());
        assertEquals(2, queue.stationView().get("left"));

        // L'anteprima trovata dal server arriva anche ai brani della radio.
        String id = queue.missingPreviews(5).get(0).id();
        assertTrue(queue.setPreview(id, PREVIEW, null, null));
        assertEquals(PREVIEW, queue.current().preview());
    }
}
