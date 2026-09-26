package com.capstone.vinyldex.service;

import com.capstone.vinyldex.entity.Card;
import com.capstone.vinyldex.entity.UserCard;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.CardRepository;
import com.capstone.vinyldex.repository.UserCardRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

/**
 * Il perito dell'hotel (Ottavio) esamina una carta della collezione e le da' un voto da 1 a 10,
 * come le agenzie di gradazione vere. Costa 50 gold e si fa una volta sola: un bel voto fa valere
 * la copia di piu' al negozio e negli scambi con gli NPC, uno brutto un po' meno.
 */
@Service
public class GradingService {

    public static final String APPRAISER = "Ottavio il perito";
    public static final int FEE = 50;
    /** Probabilita' dei voti 1..10: i piu' frequenti sono 7 e 8, il 10 e' raro. */
    static final int[] WEIGHTS = {1, 1, 2, 3, 6, 10, 16, 24, 14, 5};

    private final UserCardRepository userCardRepository;
    private final CardRepository cardRepository;
    private final WalletService walletService;
    private final Random random;

    public GradingService(UserCardRepository userCardRepository, CardRepository cardRepository, WalletService walletService) {
        this.userCardRepository = userCardRepository;
        this.cardRepository = cardRepository;
        this.walletService = walletService;
        this.random = new Random();
    }

    /** Quanto vale in piu' (o in meno) una copia con questo voto. */
    public static double multiplier(Integer grade) {
        if (grade == null) return 1.0;
        return switch (grade) {
            case 10 -> 2.0;
            case 9 -> 1.6;
            case 8 -> 1.35;
            case 7 -> 1.15;
            case 6 -> 1.0;
            case 5 -> 0.9;
            default -> 0.8;
        };
    }

    public static String label(int grade) {
        return switch (grade) {
            case 10 -> "Gemma perfetta";
            case 9 -> "Quasi perfetta";
            case 8 -> "Ottima";
            case 7 -> "Molto buona";
            case 6 -> "Buona";
            case 5 -> "Discreta";
            default -> "Rovinata";
        };
    }

    static int roll(Random random) {
        int total = 0;
        for (int w : WEIGHTS) total += w;
        int pick = random.nextInt(total);
        for (int i = 0; i < WEIGHTS.length; i++) {
            pick -= WEIGHTS[i];
            if (pick < 0) return i + 1;
        }
        return WEIGHTS.length;
    }

    @Transactional
    public Map<String, Object> grade(UUID userId, String cardCode) {
        Card card = cardRepository.findByCode(cardCode).orElseThrow(() -> ApiException.notFound("card_not_found"));
        UserCard owned = userCardRepository.findByUserIdAndCardId(userId, card.getId())
                .filter(uc -> uc.getQuantity() > 0)
                .orElseThrow(() -> ApiException.badRequest("card_not_owned"));
        if (owned.getGrade() != null) throw ApiException.badRequest("card_already_graded");
        walletService.adjustGold(userId, -FEE, WalletTransactionType.GRADING, card.getCode(), "Perito: " + card.getName());
        int grade = roll(random);
        owned.setGrade(grade);
        owned.setGradedAt(Instant.now());
        userCardRepository.save(owned);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("grade", grade);
        result.put("label", label(grade));
        result.put("multiplier", multiplier(grade));
        result.put("appraiser", APPRAISER);
        return result;
    }
}
