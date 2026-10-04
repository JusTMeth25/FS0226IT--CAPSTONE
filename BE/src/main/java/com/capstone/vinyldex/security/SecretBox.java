package com.capstone.vinyldex.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Cifra i piccoli segreti da salvare nel database (i segreti TOTP) con AES-256-GCM: chi legge
 * solo il database, per esempio da un backup, non puo' generare i codici degli utenti.
 *
 * La chiave viene da TWO_FACTOR_KEY oppure, se manca, dal JWT_SECRET; cambiarla rende illeggibili
 * i segreti gia' salvati, quindi va decisa una volta sola.
 */
@Component
public class SecretBox {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int IV_BYTES = 12;

    private final SecretKeySpec key;

    public SecretBox(@Value("${vinyldex.two-factor.key:${vinyldex.jwt.secret}}") String secret) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(("vinyldex-2fa:" + secret).getBytes(StandardCharsets.UTF_8));
            this.key = new SecretKeySpec(digest, "AES");
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public String encrypt(String plain) {
        try {
            byte[] iv = new byte[IV_BYTES];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] sealed = cipher.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + sealed.length).put(iv).put(sealed).array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Cifratura non riuscita", e);
        }
    }

    public String decrypt(String box) {
        try {
            byte[] all = Base64.getDecoder().decode(box);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, all, 0, IV_BYTES));
            return new String(cipher.doFinal(all, IV_BYTES, all.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException("Segreto non leggibile: chiave cambiata?", e);
        }
    }

    /** SHA-256 in esadecimale, per i token casuali lunghi (dispositivi fidati, codici di emergenza). */
    public static String sha256(String value) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : d) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
