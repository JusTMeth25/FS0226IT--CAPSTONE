package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.User;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.service.WalletService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

/**
 * Vendita di SmokeShop: in tabaccheria e al Green Shop dal bancone, in discoteca dal tipo losco.
 * Si paga in gold; quello che si compra finisce subito in mano all'avatar.
 *
 * Dal tipo losco c'e' un rischio: se in sala c'e' il buttafuori, a volte se ne accorge e la roba
 * sparisce (i gold no, quelli sono gia' andati).
 */
@Service
public class SmokeShopService {

    static final double BUST_CHANCE = 0.15;

    private final WalletService wallet;
    private final Random random;

    @org.springframework.beans.factory.annotation.Autowired
    public SmokeShopService(WalletService wallet) {
        this(wallet, new Random());
    }

    SmokeShopService(WalletService wallet, Random random) {
        this.wallet = wallet;
        this.random = random;
    }

    /** Il negozio che si trova in questa stanza (o null): serve al pannello per sapere cosa mostrare. */
    public static String shopIn(RoomInstance room) {
        if (room == null) return null;
        if (NpcRoster.TOBACCO.equals(room.data().id())) return SmokeShop.TOBACCO;
        if (NpcRoster.GREEN_SHOP.equals(room.data().id())) return SmokeShop.GREEN;
        if (!room.npcsWithRole(Set.of(NpcRoster.Role.DEALER)).isEmpty()) return SmokeShop.DEALER;
        return null;
    }

    @Transactional
    public Map<String, Object> buy(UUID userId, String username, RoomInstance room, String itemId) {
        SmokeShop.Item item = SmokeShop.item(itemId);
        if (item == null) throw ApiException.badRequest("smoke_unknown");
        if (room == null || !item.shop().equals(shopIn(room))) throw ApiException.badRequest("smoke_wrong_shop");
        User user = wallet.adjustGold(userId, -item.price(), WalletTransactionType.SHOP, "smoke:" + item.id(), item.name());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("type", "smoke_bought");
        out.put("item", item.id());
        out.put("name", item.name());
        out.put("gold", user.getGold());
        Set<NpcRoster.Role> sellers = Set.of(NpcRoster.Role.TOBACCONIST, NpcRoster.Role.GROWER, NpcRoster.Role.DEALER);
        List<UUID> seller = room.npcsWithRole(sellers);
        if (SmokeShop.DEALER.equals(item.shop())) {
            List<UUID> bouncer = room.npcsWithRole(Set.of(NpcRoster.Role.BOUNCER));
            if (!bouncer.isEmpty() && random.nextDouble() < BUST_CHANCE) {
                room.npcSay(bouncer.getFirst(), pick(List.of(
                        "Ehi " + username + "! Cosa hai in mano? Sequestrato. E fila in pista!",
                        "Beccato, " + username + "! Qui la roba non gira: la tengo io.",
                        "Niente scherzi nel mio locale, " + username + ". Questa la butto via.")), userId);
                out.put("busted", true);
                return out;
            }
        }
        room.giveHandItem(userId, item.id(), item.puffs());
        if (!seller.isEmpty()) room.npcSay(seller.getFirst(), sold(item, username), userId);
        return out;
    }

    private String sold(SmokeShop.Item item, String user) {
        return switch (item.shop()) {
            case SmokeShop.TOBACCO -> pick(List.of("Ecco a te, " + user + ": " + item.name().toLowerCase() + ". Accendino in omaggio!",
                    "Buona fumata, " + user + "! E occhio a non bruciare la moquette."));
            case SmokeShop.GREEN -> pick(List.of("Peace, " + user + "! " + item.name() + " pronta, rilassati.",
                    "Ecco la tua " + item.name().toLowerCase() + ", " + user + ". Good vibes!"));
            default -> pick(List.of("Tieni, " + user + "... e non dire chi te l'ha data.",
                    "Roba buona, " + user + ". Ci vediamo in pista."));
        };
    }

    private String pick(List<String> lines) {
        return lines.get(random.nextInt(lines.size()));
    }
}
