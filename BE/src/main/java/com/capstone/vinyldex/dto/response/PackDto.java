package com.capstone.vinyldex.dto.response;

import com.capstone.vinyldex.entity.Pack;

import java.util.LinkedHashMap;
import java.util.Map;

/** Pacchetto in vetrina. Come per le carte, l'id pubblico e' il code (es. "pack-base"). */
public record PackDto(
        String id,
        String name,
        String description,
        int price,
        int cardCount,
        boolean isFree,
        int freeCooldownHours,
        Map<String, Double> dropRates,
        Map<String, Integer> guarantees,
        int giftedCount
) {

    public static PackDto from(Pack pack, int giftedCount) {
        Map<String, Double> rates = new LinkedHashMap<>();
        pack.getDropRates().forEach(dr -> rates.put(dr.getRarity(), dr.getWeight()));

        Map<String, Integer> guarantees = new LinkedHashMap<>();
        pack.getGuarantees().forEach(g -> guarantees.put(g.getRarity(), g.getCount()));

        return new PackDto(
                pack.getCode(), pack.getName(), pack.getDescription(), pack.getPriceGold(),
                pack.getCardCount(), pack.isFree(), pack.getFreeCooldownHours(),
                rates, guarantees, giftedCount);
    }
}
