package com.capstone.vinyldex.hotel;

import com.capstone.vinyldex.entity.UserPet;
import com.capstone.vinyldex.entity.WalletTransactionType;
import com.capstone.vinyldex.exception.ApiException;
import com.capstone.vinyldex.repository.UserPetRepository;
import com.capstone.vinyldex.service.WalletService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Animali da compagnia: si adottano nel negozio dell'hotel, seguono il giocatore nelle stanze e
 * vanno nutriti. Se non mangiano da un giorno sono affamati (e tristi): si vede sopra di loro.
 */
@Service
public class PetService {

    /** Tipi, nome e prezzo in gold. */
    public record PetType(String type, String name, int price) {
    }

    public static final List<PetType> TYPES = List.of(
            new PetType("dog", "Cane", 300), new PetType("cat", "Gatto", 250), new PetType("bunny", "Coniglio", 200));
    static final int FOOD_PRICE = 10;
    static final Duration HUNGRY_AFTER = Duration.ofHours(24);

    /** Animale come lo vedono gli altri nell'hotel. */
    public record HotelPet(String type, String name, boolean hungry) {
    }

    private final UserPetRepository pets;
    private final WalletService walletService;
    private final RoomRegistry registry;

    public PetService(UserPetRepository pets, WalletService walletService, RoomRegistry registry) {
        this.pets = pets;
        this.walletService = walletService;
        this.registry = registry;
    }

    @Transactional(readOnly = true)
    public HotelPet petOf(UUID userId) {
        return pets.findById(userId).map(PetService::view).orElse(null);
    }

    static HotelPet view(UserPet pet) {
        return new HotelPet(pet.getType(), pet.getName(), pet.getFedAt().plus(HUNGRY_AFTER).isBefore(Instant.now()));
    }

    /** Catalogo e l'animale del giocatore, se ne ha uno. */
    @Transactional(readOnly = true)
    public Map<String, Object> summary(UUID userId) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("types", TYPES);
        result.put("foodPrice", FOOD_PRICE);
        UserPet pet = pets.findById(userId).orElse(null);
        if (pet != null) {
            Map<String, Object> mine = new LinkedHashMap<>();
            mine.put("type", pet.getType());
            mine.put("name", pet.getName());
            mine.put("fedAt", pet.getFedAt());
            mine.put("hungry", view(pet).hungry());
            result.put("pet", mine);
        }
        return result;
    }

    @Transactional
    public Map<String, Object> adopt(UUID userId, String type, String rawName) {
        if (pets.existsById(userId)) throw ApiException.badRequest("pet_owned");
        PetType kind = TYPES.stream().filter(t -> t.type().equals(type)).findFirst()
                .orElseThrow(() -> ApiException.badRequest("pet_type"));
        String name = rawName == null ? "" : rawName.trim().replaceAll("[^\\p{L}\\p{N} ]", "");
        if (name.isEmpty()) name = kind.name();
        if (name.length() > 20) name = name.substring(0, 20);
        walletService.adjustGold(userId, -kind.price(), WalletTransactionType.PET, "pet:" + type, "Adozione: " + kind.name());
        pets.save(new UserPet(userId, type, name));
        refresh(userId);
        return summary(userId);
    }

    @Transactional
    public Map<String, Object> feed(UUID userId) {
        UserPet pet = pets.findById(userId).orElseThrow(() -> ApiException.notFound("pet_not_found"));
        walletService.adjustGold(userId, -FOOD_PRICE, WalletTransactionType.PET, "pet:food", "Cibo per " + pet.getName());
        pet.setFedAt(Instant.now());
        pets.save(pet);
        refresh(userId);
        return summary(userId);
    }

    /** L'animale va a vivere in una fattoria: il giocatore puo' adottarne un altro. */
    @Transactional
    public Map<String, Object> release(UUID userId) {
        pets.deleteById(userId);
        pets.flush();
        refresh(userId);
        return summary(userId);
    }

    /** Chi e' nell'hotel vede subito l'animale nuovo (o sazio, o andato via). */
    private void refresh(UUID userId) {
        HotelSession session = registry.sessionOf(userId);
        if (session == null || session.user() == null) return;
        HotelUser updated = session.user().withPet(petOf(userId));
        session.authenticate(updated);
        RoomInstance room = registry.get(session.roomId());
        if (room != null) room.updateUser(updated);
    }
}
