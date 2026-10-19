package com.capstone.vinyldex.security;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Indirizzo IP del client, letto in un posto solo (rate limit, tentativi di login, recupero password).
 *
 * In produzione l'app sta dietro a Caddy, che aggiunge l'IP vero in fondo a X-Forwarded-For.
 * Il primo valore invece lo puo' scrivere chiunque: usarlo permetterebbe di aggirare i limiti
 * cambiando l'intestazione a ogni richiesta. Per questo si prende l'ultimo.
 */
public final class ClientIp {

    private ClientIp() {
    }

    public static String of(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String[] hops = forwarded.split(",");
            String last = hops[hops.length - 1].trim();
            if (!last.isEmpty()) return last;
        }
        return request.getRemoteAddr();
    }
}
