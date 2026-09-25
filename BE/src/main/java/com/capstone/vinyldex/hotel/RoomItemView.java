package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.RoomItem;

import java.util.UUID;

/**
 * Mobile come lo tiene in memoria RoomInstance e come lo ricevono i client.
 * Per vetrine e quadri porta con se' i dati essenziali della carta esposta.
 */
public record RoomItemView(UUID id, UUID ownerId, String type, int x, int y, int z, int rot, CardView card) {

    /** Carta esposta: id e' il code pubblico, come nel resto delle API. */
    public record CardView(String id, String name, String rarity, String img, String source, boolean fullImage,
                           Double marketPrice) {

        static CardView from(Card card) {
            if (card == null) return null;
            return new CardView(card.getCode(), card.getName(), card.getRarity(), card.getImgUrl(),
                    card.getSource(), card.isFullImage(), card.getMarketPrice());
        }
    }

    public static RoomItemView from(RoomItem item) {
        return new RoomItemView(item.getId(), item.getOwner() != null ? item.getOwner().getId() : null,
                item.getFurniType(), item.getX(), item.getY(), item.getZ(), item.getRot(), CardView.from(item.getCard()));
    }

    public FurniCatalog.FurniDef def() {
        return FurniCatalog.get(type).orElseThrow();
    }

    /** La casella (tx, ty) e' coperta da questo mobile a pavimento? */
    public boolean covers(int tx, int ty) {
        FurniCatalog.FurniDef def = def();
        if (def.wall()) return false;
        return tx >= x && tx < x + def.footprintX(rot) && ty >= y && ty < y + def.footprintY(rot);
    }
}
