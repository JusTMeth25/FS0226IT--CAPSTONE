package com.capstone.vinyldex.casino;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserRepository;
import com.capstone.vinyldex.service.WalletService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Cassa del banco del casino. Ogni puntata dei giocatori entra (i soldi vanno al banco), ogni
 * vincita esce: il saldo e' quanto il casino ha guadagnato e non ha ancora riscosso. Lo riscuote
 * l'admin, il gestore del locale, nel proprio portafoglio (gold) o fra le sue fiches.
 *
 * Il saldo puo' anche scendere sotto zero (una serata fortunata dei giocatori): in quel caso non
 * c'e' niente da riscuotere finche' non torna positivo.
 */
@Service
public class CasinoBank {

    private final JdbcTemplate jdbc;
    private final UserRepository userRepository;
    private final WalletService walletService;

    public CasinoBank(JdbcTemplate jdbc, UserRepository userRepository, WalletService walletService) {
        this.jdbc = jdbc;
        this.userRepository = userRepository;
        this.walletService = walletService;
    }

    /** Movimento di un gioco visto dal banco: positivo se il giocatore ha perso, negativo se ha vinto. */
    public void record(CasinoService.Currency currency, long amount) {
        if (amount == 0) return;
        jdbc.update("update casino_bank set balance = balance + ?, earned = earned + ?, updated_at = now() where currency = ?",
                amount, amount, currency.name());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> view() {
        Map<String, Object> out = new LinkedHashMap<>();
        jdbc.query("select currency, balance, earned, withdrawn from casino_bank", rs -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("balance", rs.getLong("balance"));
            row.put("earned", rs.getLong("earned"));
            row.put("withdrawn", rs.getLong("withdrawn"));
            out.put(rs.getString("currency").toLowerCase(), row);
        });
        List<Map<String, Object>> history = jdbc.queryForList("""
                select w.currency, w.amount, w.created_at as at, u.username
                from casino_bank_withdrawals w join users u on u.id = w.admin_id
                order by w.created_at desc limit 10""");
        out.put("history", history);
        return out;
    }

    /**
     * L'admin riscuote: {@code amount} null o 0 = tutto il saldo. I gold vanno nel suo portafoglio
     * (movimento CASINO), le fiches fra le sue fiches.
     */
    @Transactional
    public Map<String, Object> withdraw(UUID adminId, String currencyName, Long amount) {
        CasinoService.Currency currency = "gold".equalsIgnoreCase(currencyName) ? CasinoService.Currency.GOLD : CasinoService.Currency.CHIPS;
        Long balance = jdbc.queryForObject("select balance from casino_bank where currency = ? for update", Long.class, currency.name());
        long available = balance == null ? 0 : balance;
        long take = amount == null || amount <= 0 ? available : amount;
        if (available <= 0) throw ApiException.badRequest("casino_bank_empty");
        if (take > available) throw ApiException.badRequest("casino_bank_not_enough");
        if (take > Integer.MAX_VALUE) take = Integer.MAX_VALUE;
        jdbc.update("update casino_bank set balance = balance - ?, withdrawn = withdrawn + ?, updated_at = now() where currency = ?",
                take, take, currency.name());
        jdbc.update("insert into casino_bank_withdrawals (admin_id, currency, amount) values (?, ?, ?)", adminId, currency.name(), take);
        if (currency == CasinoService.Currency.GOLD) {
            walletService.adjustGold(adminId, (int) take, WalletTransactionType.CASINO, "casino:bank", "Incasso del casino riscosso dal gestore");
        } else {
            User admin = userRepository.findByIdForUpdate(adminId).orElseThrow(() -> ApiException.notFound("user_not_found"));
            admin.setCasinoChips((int) Math.min(Integer.MAX_VALUE, (long) admin.getCasinoChips() + take));
            userRepository.save(admin);
        }
        Map<String, Object> out = view();
        out.put("taken", take);
        out.put("currency", currency.name().toLowerCase());
        return out;
    }
}
