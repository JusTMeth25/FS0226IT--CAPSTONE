package com.capstone.vinyldex.exception;

import org.springframework.http.HttpStatus;

/**
 * Errore applicativo con il codice testuale che il frontend gia' conosce
 * (es. "insufficient_gold"): il corpo della risposta resta {"error": "<code>"},
 * identico a quello che restituiva il backend Express.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final String reason;

    public ApiException(HttpStatus status, String code) {
        this(status, code, null);
    }

    public ApiException(HttpStatus status, String code, String reason) {
        super(code);
        this.status = status;
        this.code = code;
        this.reason = reason;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    /** Dettaglio facoltativo, usato per esempio dal motivo del ban. */
    public String getReason() {
        return reason;
    }

    public static ApiException badRequest(String code) {
        return new ApiException(HttpStatus.BAD_REQUEST, code);
    }

    public static ApiException notFound(String code) {
        return new ApiException(HttpStatus.NOT_FOUND, code);
    }

    public static ApiException conflict(String code) {
        return new ApiException(HttpStatus.CONFLICT, code);
    }

    public static ApiException forbidden(String code) {
        return new ApiException(HttpStatus.FORBIDDEN, code);
    }

    public static ApiException unauthorized(String code) {
        return new ApiException(HttpStatus.UNAUTHORIZED, code);
    }

    /** 402 Payment Required: saldo gold insufficiente. */
    public static ApiException insufficientGold() {
        return new ApiException(HttpStatus.PAYMENT_REQUIRED, "insufficient_gold");
    }
}
