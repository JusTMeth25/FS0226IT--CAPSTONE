package com.capstone.vinyldex.controller;

import com.capstone.vinyldex.casino.CasinoBank;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.hotel.HotelSession;
import com.capstone.vinyldex.hotel.NpcRoster;
import com.capstone.vinyldex.hotel.RoomRegistry;
import com.capstone.vinyldex.security.CurrentUser;
import com.capstone.vinyldex.security.UserPrincipal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import com.capstone.vinyldex.config.OpenApiConfig.Tags;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** Incassi del casino: il gestore (admin) vede la cassa del banco e la riscuote dalla cassaforte del Caveau. */
@Tag(name = Tags.ADMIN, description = Tags.ADMIN_INFO)
@RestController
@RequestMapping("/api/admin/casino")
@PreAuthorize("hasRole('ADMIN')")
public class AdminCasinoController {

    private final CasinoBank bank;
    private final RoomRegistry registry;

    public AdminCasinoController(CasinoBank bank, RoomRegistry registry) {
        this.bank = bank;
        this.registry = registry;
    }

    public record WithdrawRequest(String currency, Long amount) {
    }

    @Operation(summary = "Cassa del banco del casinò")
    @GetMapping("/bank")
    public Map<String, Object> bank() {
        return bank.view();
    }

    /** {"currency": "gold" | "chips", "amount": n} — senza amount (o 0) si riscuote tutto. */
    @Operation(summary = "Riscuote gli incassi del casinò",
            description = "Si riscuote solo stando nel Caveau dell'hotel. Senza amount (o con 0) si ritira tutto.")
    @PostMapping("/bank/withdraw")
    public Map<String, Object> withdraw(@CurrentUser UserPrincipal principal, @RequestBody WithdrawRequest request) {
        // Si riscuote solo dalla cassaforte, stando nel Caveau dell'hotel.
        HotelSession session = registry.sessionOf(principal.getId());
        if (session == null || !NpcRoster.VAULT.equals(session.roomId())) throw ApiException.forbidden("vault_go_to_safe");
        return bank.withdraw(principal.getId(), request.currency(), request.amount());
    }
}
