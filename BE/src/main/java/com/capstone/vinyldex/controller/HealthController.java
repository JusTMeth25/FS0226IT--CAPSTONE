package com.capstone.vinyldex.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;

/** Sonda di salute: conferma che l'applicazione risponde e che il database e' raggiungibile. */
@Tag(name = Tags.SISTEMA, description = Tags.SISTEMA_INFO)
@RestController
public class HealthController {

    private final JdbcTemplate jdbcTemplate;

    public HealthController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Operation(summary = "Stato dell'applicazione e del database")
    @SecurityRequirements
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return ResponseEntity.ok(Map.of("status", "ok", "db", "connected"));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("status", "error", "db", "unreachable"));
        }
    }
}
