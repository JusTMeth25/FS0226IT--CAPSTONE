package com.capstone.vinyldex.controller;

import java.util.Map;

/** Accesso dai test di altri pacchetti al disegno della carta FC 27 (metodo di pacchetto). */
public final class FcCardArtControllerProbe {

    private FcCardArtControllerProbe() {
    }

    public static byte[] shrink(byte[] bytes) throws java.io.IOException {
        return FcCardArtController.shrink(bytes);
    }

    public static String render(String name, Map<String, Object> meta) {
        return FcCardArtController.render(name, meta, null);
    }
}
