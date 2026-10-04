package com.capstone.vinyldex.security;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;

/**
 * Codici a 6 cifre che cambiano ogni 30 secondi (TOTP, RFC 6238), gli stessi di Google
 * Authenticator, Microsoft Authenticator, 1Password e simili: HMAC-SHA1 del numero di intervalli
 * trascorsi, con il segreto condiviso scritto in Base32 nel QR code.
 */
public final class Totp {

    public static final int STEP_SECONDS = 30;
    private static final int DIGITS = 6;
    private static final String BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final SecureRandom RANDOM = new SecureRandom();

    private Totp() {
    }

    /** Segreto nuovo da 160 bit, in Base32 senza "=" come lo vogliono le app. */
    public static String newSecret() {
        byte[] bytes = new byte[20];
        RANDOM.nextBytes(bytes);
        return base32(bytes);
    }

    public static long stepAt(long epochSeconds) {
        return Math.floorDiv(epochSeconds, STEP_SECONDS);
    }

    public static String code(String secret, long step) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(base32Decode(secret), "HmacSHA1"));
            byte[] hash = mac.doFinal(ByteBuffer.allocate(8).putLong(step).array());
            int offset = hash[hash.length - 1] & 0x0f;
            int binary = ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16)
                    | ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);
            return String.format("%06d", binary % 1_000_000);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA1 non disponibile", e);
        }
    }

    /**
     * Intervallo in cui il codice e' valido, cercando anche quello prima e quello dopo (orologio
     * del telefono un po' avanti o indietro); -1 se non vale. Gli intervalli fino ad {@code afterStep}
     * compreso sono gia' stati usati e non contano: cosi' un codice letto da qualcuno non si riusa.
     */
    public static long matchingStep(String secret, String code, long nowStep, long afterStep) {
        String clean = code == null ? "" : code.replaceAll("\\s", "");
        if (clean.length() != DIGITS || !clean.chars().allMatch(Character::isDigit)) return -1;
        for (long step = nowStep - 1; step <= nowStep + 1; step++) {
            if (step > afterStep && constantTimeEquals(code(secret, step), clean)) return step;
        }
        return -1;
    }

    /** Indirizzo otpauth:// da mettere nel QR code. */
    public static String uri(String issuer, String account, String secret) {
        String label = enc(issuer) + ":" + enc(account);
        return "otpauth://totp/" + label + "?secret=" + secret + "&issuer=" + enc(issuer)
                + "&algorithm=SHA1&digits=" + DIGITS + "&period=" + STEP_SECONDS;
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20");
    }

    static boolean constantTimeEquals(String a, String b) {
        return java.security.MessageDigest.isEqual(a.getBytes(StandardCharsets.US_ASCII), b.getBytes(StandardCharsets.US_ASCII));
    }

    static String base32(byte[] data) {
        StringBuilder out = new StringBuilder();
        int buffer = 0;
        int bits = 0;
        for (byte b : data) {
            buffer = (buffer << 8) | (b & 0xff);
            bits += 8;
            while (bits >= 5) {
                out.append(BASE32.charAt((buffer >> (bits - 5)) & 31));
                bits -= 5;
            }
        }
        if (bits > 0) out.append(BASE32.charAt((buffer << (5 - bits)) & 31));
        return out.toString();
    }

    static byte[] base32Decode(String text) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        int buffer = 0;
        int bits = 0;
        for (char c : text.toUpperCase().replace("=", "").replace(" ", "").toCharArray()) {
            int value = BASE32.indexOf(c);
            if (value < 0) throw new IllegalArgumentException("Carattere Base32 non valido");
            buffer = (buffer << 5) | value;
            bits += 5;
            if (bits >= 8) {
                out.write((buffer >> (bits - 8)) & 0xff);
                bits -= 8;
            }
        }
        return out.toByteArray();
    }
}
