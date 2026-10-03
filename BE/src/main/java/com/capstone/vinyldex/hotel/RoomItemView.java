package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.dto.response.CardDto;
import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.RoomItem;

import java.util.UUID;

/**
 * Mobile come lo tiene in memoria RoomInstance e come lo ricevono i client.
 * Per vetrine e quadri porta con se' i dati essenziali della carta esposta.
 */
public record RoomItemView(UUID id, UUID ownerId, String type, int x, int y, int z, int rot, CardView card) {

    /**
     * Carta esposta: id e' il code pubblico, come nel resto delle API. Se la copia del padrone e'
     * gradata ci sono anche voto e certificato, cosi' vetrine e teca la mostrano nel cofanetto.
     */
    public record CardView(String id, String name, String rarity, String img, String source, boolean fullImage,
                           Double marketPrice, Long coinPrice, Integer grade, String gradeCert, String setName, String number,
                           // Finitura olografica (CardFinish) e copia olografica: le stesse luci della collezione.
                           String finish, int foil) {

        static CardView from(Card card) {
            if (card == null) return null;
            return new CardView(card.getCode(), card.getName(), card.getRarity(), card.getImgUrl(),
                    card.getSource(), card.isFullImage(), card.getMarketPrice(), CardDto.coinPrice(card), null, null,
                    card.getSetName(), card.getNumber(), com.capstone.vinyldex.dto.response.CardFinish.of(card), card.isHolo() ? 1 : 0);
        }

        CardView withGrade(Integer grade, String cert) {
            return new CardView(id, name, rarity, img, source, fullImage, marketPrice, coinPrice, grade, cert, setName, number, finish, foil);
        }
    }

    /** Stesso mobile con il voto della copia esposta (se il padrone l'ha fatta gradare). */
    public RoomItemView withGrade(com.capstone.vinyldex.entity.UserCard owned) {
        if (card == null || owned == null || owned.getGrade() == null) return this;
        return new RoomItemView(id, ownerId, type, x, y, z, rot,
                card.withGrade(owned.getGrade(), com.capstone.vinyldex.dto.response.CollectionEntryDto.certificate(owned)));
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
