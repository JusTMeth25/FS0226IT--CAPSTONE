package com.capstone.vinyldex.dto.response;

/** Risposta di register e login: profilo piu' token da salvare lato client. */
public record AuthResponse(AuthUserDto user, String token) {
}
