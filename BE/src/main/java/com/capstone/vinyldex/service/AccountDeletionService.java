package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * "Elimina account" del profilo: cancella l'utente e tutti i suoi dati (diritto alla cancellazione,
 * art. 17 GDPR, vedi la pagina Privacy).
 *
 * Quasi tutte le tabelle legate a users hanno ON DELETE CASCADE (stanze, arredi, amici, messaggi,
 * dispositivi fidati...) o SET NULL (vincitori di partite e tornei, offerte alle aste). Quelle
 * create con le prime migrazioni no: carte, pacchetti, mercato, scambi, movimenti dei gold e
 * missioni si cancellano qui a mano, prima dell'utente, nella stessa transazione.
 *
 * Conferma: lo username scritto per intero, la password (non per chi e' entrato solo con Google,
 * che una password non ce l'ha) e il codice della verifica in due passaggi se e' attiva.
 * Gli admin non si eliminano da qui: restano legati ai prelievi della banca del casino'.
 *
 * Dal pannello admin ({@link #deleteByAdmin}) un admin elimina un utente senza le sue conferme:
 * non se stesso, non un altro admin e non i personaggi dell'hotel (NPC).
 */
@Service
public class AccountDeletionService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbc;
    private TwoFactorService twoFactor;

    public AccountDeletionService(UserRepository userRepository, PasswordEncoder passwordEncoder, JdbcTemplate jdbc) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbc = jdbc;
    }

    @Autowired(required = false)
    void setTwoFactor(TwoFactorService twoFactor) {
        this.twoFactor = twoFactor;
    }

    @Transactional(noRollbackFor = ApiException.class)
    public void delete(UUID userId, String username, String password, String code) {
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("not_found"));
        if (user.isAdmin()) throw ApiException.forbidden("admin_cannot_delete");
        if (username == null || !username.trim().equals(user.getUsername())) throw ApiException.badRequest("delete_username_mismatch");
        if (!socialOnly(userId) && (password == null || !passwordEncoder.matches(password, user.getPasswordHash()))) {
            throw ApiException.unauthorized("invalid_password");
        }
        if (user.isTwoFactorEnabled() && (twoFactor == null || !twoFactor.verify(user, code))) {
            throw ApiException.badRequest("invalid_two_factor_code");
        }
        erase(user);
    }

    /** Eliminazione dal pannello admin: niente password, basta lo username scritto per conferma. */
    @Transactional
    public void deleteByAdmin(UUID adminId, UUID userId, String username) {
        if (userId.equals(adminId)) throw ApiException.badRequest("cannot_delete_self");
        User user = userRepository.findById(userId).orElseThrow(() -> ApiException.notFound("not_found"));
        if (user.isAdmin()) throw ApiException.forbidden("admin_cannot_delete");
        if (user.isNpc()) throw ApiException.forbidden("npc_cannot_delete");
        if (username == null || !username.trim().equals(user.getUsername())) throw ApiException.badRequest("delete_username_mismatch");
        erase(user);
    }

    /** Account creato con Google: ha un'identita' collegata e la password e' casuale. */
    private boolean socialOnly(UUID userId) {
        Integer linked = jdbc.queryForObject("select count(*) from user_identities where user_id = ?", Integer.class, userId);
        return linked != null && linked > 0;
    }

    private void erase(User user) {
        UUID userId = user.getId();
        jdbc.update("delete from trade_items where trade_id in (select id from trades where from_user_id = ? or to_user_id = ?)", userId, userId);
        jdbc.update("delete from trades where from_user_id = ? or to_user_id = ?", userId, userId);
        jdbc.update("delete from pack_opening_cards where pack_opening_id in (select id from pack_openings where user_id = ?)", userId);
        jdbc.update("delete from pack_openings where user_id = ?", userId);
        jdbc.update("delete from market_listings where seller_id = ?", userId);
        jdbc.update("delete from user_wallet_transactions where user_id = ?", userId);
        jdbc.update("delete from user_missions where user_id = ?", userId);
        jdbc.update("delete from user_pack_credits where user_id = ?", userId);
        jdbc.update("delete from user_cards where user_id = ?", userId);
        // L'utente per ultimo e con JPA: la sessione lo tiene in memoria (la verifica dei codici lo
        // modifica) e un update dopo un delete fatto a mano fallirebbe alla chiusura della transazione.
        userRepository.delete(user);
    }
}
