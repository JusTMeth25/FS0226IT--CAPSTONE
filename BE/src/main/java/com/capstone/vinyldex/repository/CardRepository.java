package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.Card;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CardRepository extends JpaRepository<Card, UUID> {

    /** Lookup dall'id pubblico usato dal frontend, che e' il code e non lo UUID. */
    Optional<Card> findByCode(String code);

    Optional<Card> findBySourceAndExternalId(String source, String externalId);

    long countByActiveTrue();

    @Query("SELECT c FROM Card c LEFT JOIN FETCH c.artistClass WHERE c.active = true")
    List<Card> findAllActiveWithArtistClass();

    @Query("SELECT c FROM Card c LEFT JOIN FETCH c.artistClass WHERE c.code = :code")
    Optional<Card> findByCodeWithArtistClass(@Param("code") String code);

    @Query("SELECT c FROM Card c LEFT JOIN FETCH c.artistClass ORDER BY c.createdAt DESC")
    List<Card> findAllWithArtistClassOrderByCreatedAtDesc();

    /**
     * Catalogo filtrato. Ogni filtro nullo viene ignorato, cosi' la stessa query serve
     * tutte le combinazioni della pagina collezione.
     */
    @Query("""
            SELECT c FROM Card c
            LEFT JOIN FETCH c.artistClass
            WHERE c.active = true
              AND (:rarity IS NULL OR c.rarity = :rarity)
              AND (:source IS NULL OR c.source = :source)
              AND (:search IS NULL OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:set IS NULL OR LOWER(c.setName) LIKE LOWER(CONCAT('%', :set, '%'))
                                OR LOWER(c.setCode) LIKE LOWER(CONCAT('%', :set, '%')))
            ORDER BY c.name ASC
            """)
    List<Card> search(@Param("search") String search,
                      @Param("rarity") String rarity,
                      @Param("set") String set,
                      @Param("source") String source);
}
