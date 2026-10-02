package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.config.CacheConfig;
import com.capstone.vinyldex.entity.Card;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CardRepository extends JpaRepository<Card, UUID> {

    /** Salvare una carta (import, pannello admin, statistiche) svuota la cache del catalogo. */
    @Override
    @CacheEvict(value = CacheConfig.ACTIVE_CARDS, allEntries = true)
    <S extends Card> S save(S entity);

    @Override
    @CacheEvict(value = CacheConfig.ACTIVE_CARDS, allEntries = true)
    <S extends Card> List<S> saveAll(Iterable<S> entities);

    /** Lookup dall'id pubblico usato dal frontend, che e' il code e non lo UUID. */
    Optional<Card> findByCode(String code);

    Optional<Card> findBySourceAndExternalId(String source, String externalId);

    long countBySource(String source);

    long countByActiveTrue();

    /** Carte di altre fonti con statistiche esattamente uguali a quelle date (vedi CardStatsBackfill). */
    List<Card> findBySourceNotAndFansAndStyleAndInfluenceAndEnergy(String source, int fans, int style,
                                                                 int influence, int energy);

    /**
     * Tutte le carte attive, dalla cache (CacheConfig): la lista e' condivisa, non va modificata,
     * e le carte sono staccate dalla sessione (si leggono, non si salvano da qui).
     */
    @Cacheable(CacheConfig.ACTIVE_CARDS)
    @Query("SELECT c FROM Card c LEFT JOIN FETCH c.artistClass WHERE c.active = true")
    List<Card> findAllActiveWithArtistClass();

    /** La stessa lettura, sempre dal database: la usa CatalogCacheWarmer per rinfrescare la cache. */
    @Query("SELECT c FROM Card c LEFT JOIN FETCH c.artistClass WHERE c.active = true")
    List<Card> loadAllActiveWithArtistClass();

    @Query("SELECT c FROM Card c LEFT JOIN FETCH c.artistClass WHERE c.code = :code")
    Optional<Card> findByCodeWithArtistClass(@Param("code") String code);

    @Query("SELECT c FROM Card c LEFT JOIN FETCH c.artistClass ORDER BY c.createdAt DESC")
    List<Card> findAllWithArtistClassOrderByCreatedAtDesc();

    /** Ricerca del pannello admin: per nome, codice o fonte (stringa vuota = le piu' recenti). */
    @Query("""
            SELECT c FROM Card c LEFT JOIN FETCH c.artistClass
            WHERE :q = '' OR LOWER(c.name) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(c.code) LIKE LOWER(CONCAT('%', :q, '%')) OR c.source = :q
            ORDER BY c.createdAt DESC
            """)
    List<Card> adminSearch(@Param("q") String q, org.springframework.data.domain.Pageable pageable);

    /**
     * Catalogo filtrato.
     *
     * Ogni filtro usa la stringa vuota per dire "non filtrare", invece di null: un parametro
     * nullo dentro CONCAT arriverebbe a Postgres senza tipo e la query fallirebbe con
     * "function lower(bytea) does not exist".
     */
    @Query("""
            SELECT c FROM Card c
            LEFT JOIN FETCH c.artistClass
            WHERE c.active = true
              AND (:rarity = '' OR c.rarity = :rarity)
              AND (:source = '' OR c.source = :source)
              AND (:search = '' OR LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:set = '' OR LOWER(COALESCE(c.setName, '')) LIKE LOWER(CONCAT('%', :set, '%'))
                             OR LOWER(COALESCE(c.setCode, '')) LIKE LOWER(CONCAT('%', :set, '%')))
            ORDER BY c.name ASC
            """)
    List<Card> search(@Param("search") String search,
                      @Param("rarity") String rarity,
                      @Param("set") String set,
                      @Param("source") String source);
}
