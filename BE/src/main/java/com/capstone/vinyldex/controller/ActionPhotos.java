package com.capstone.vinyldex.controller;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Foto in azione delle carte Action (NBA e FC 27): scaricate da Wikimedia Commons, o lette dai
 * file del progetto, rimpicciolite e tenute in memoria. Le usano NbaCardArtController e
 * FcCardArtController.
 */
@Component
public class ActionPhotos {

    private static final int MAX_PHOTO_BYTES = 8 * 1024 * 1024;
    private static final int CACHE_SIZE = 300;
    /** Server delle immagini di Wikimedia Commons: originali e miniature. */
    private static final java.util.Set<String> COMMONS_HOSTS = java.util.Set.of("upload.wikimedia.org", "thumb.wikimedia.org");
    private static final int ACTION_PHOTO_SIZE = 620;

    private final Map<String, NbaActionArt.Photo> photos = Collections.synchronizedMap(new LinkedHashMap<>(64, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, NbaActionArt.Photo> eldest) {
            return size() > CACHE_SIZE;
        }
    });
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    /**
     * Foto in azione della carta (metadata.actionPhoto): un file del progetto (local, sotto
     * resources/nba/photos) o una foto di Wikimedia Commons (thumb, solo dai server di immagini di
     * Wikimedia). Rimpicciolita in JPEG una volta e tenuta in memoria.
     */
    @SuppressWarnings("unchecked")
    NbaActionArt.Photo of(Map<String, Object> meta) {
        if (!(meta.get("actionPhoto") instanceof Map<?, ?> raw)) return null;
        Map<String, Object> info = (Map<String, Object>) raw;
        String key;
        if (info.get("local") instanceof String local && local.matches("[a-z0-9-]+[.](jpg|png|webp)")) {
            key = "local:" + local;
        } else if (info.get("thumb") instanceof String url) {
            key = url;
        } else {
            return null;
        }
        NbaActionArt.Photo cached = photos.get(key);
        if (cached != null) return cached.dataUri().isEmpty() ? null : cached;
        NbaActionArt.Photo photo = new NbaActionArt.Photo("", 1, 1, 0.5, 0.5, 1);
        try {
            byte[] bytes = key.startsWith("local:") ? localPhoto(key.substring(6)) : commonsPhoto(key);
            java.awt.image.BufferedImage source = bytes == null ? null : javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(bytes));
            if (source != null) {
                double scale = Math.min(1.0, (double) ACTION_PHOTO_SIZE / Math.max(source.getWidth(), source.getHeight()));
                int w = Math.max(1, (int) Math.round(source.getWidth() * scale));
                int h = Math.max(1, (int) Math.round(source.getHeight() * scale));
                java.awt.image.BufferedImage target = new java.awt.image.BufferedImage(w, h, java.awt.image.BufferedImage.TYPE_INT_RGB);
                var g = target.createGraphics();
                g.setRenderingHint(java.awt.RenderingHints.KEY_INTERPOLATION, java.awt.RenderingHints.VALUE_INTERPOLATION_BICUBIC);
                g.drawImage(source, 0, 0, w, h, null);
                g.dispose();
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                javax.imageio.ImageIO.write(target, "jpg", out);
                photo = new NbaActionArt.Photo("data:image/jpeg;base64," + Base64.getEncoder().encodeToString(out.toByteArray()), w, h,
                        number(info.get("focusX"), 0.5), number(info.get("focusY"), 0.45), number(info.get("zoom"), 1));
            }
        } catch (Exception ex) {
            if (ex instanceof InterruptedException) Thread.currentThread().interrupt();
        }
        photos.put(key, photo);
        return photo.dataUri().isEmpty() ? null : photo;
    }

    /** Foto salvata nel progetto (resources/nba/photos): il nome e' gia' stato controllato. */
    private static byte[] localPhoto(String name) throws IOException {
        var resource = new org.springframework.core.io.ClassPathResource("nba/photos/" + name);
        if (!resource.exists()) return null;
        try (InputStream in = resource.getInputStream()) {
            return in.readNBytes(MAX_PHOTO_BYTES);
        }
    }

    private byte[] commonsPhoto(String url) throws IOException, InterruptedException {
        URI uri;
        try {
            uri = URI.create(url);
        } catch (IllegalArgumentException ex) {
            return null;
        }
        if (!"https".equals(uri.getScheme()) || !COMMONS_HOSTS.contains(uri.getHost())) return null;
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(15))
                .header("User-Agent", "VinylDex-capstone/1.0 (educational project)").header("Accept", "image/*").GET().build();
        HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        try (InputStream body = response.body()) {
            byte[] bytes = body.readNBytes(MAX_PHOTO_BYTES + 1);
            return response.statusCode() == 200 && bytes.length <= MAX_PHOTO_BYTES ? bytes : null;
        }
    }

    private static double number(Object value, double fallback) {
        return value instanceof Number n ? n.doubleValue() : fallback;
    }

}
