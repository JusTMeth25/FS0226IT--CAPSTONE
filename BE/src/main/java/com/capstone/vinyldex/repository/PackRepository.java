package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.Pack;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PackRepository extends JpaRepository<Pack, UUID> {

    Optional<Pack> findByCode(String code);

    List<Pack> findAllByOrderByCreatedAtDesc();

    /**
     * Carica drop rate e garanzie in un colpo solo. Le due collezioni sono liste di dimensione
     * minuscola (una riga per rarita'), quindi il prodotto cartesiano del doppio join non pesa.
     */
    @Query("SELECT DISTINCT p FROM Pack p LEFT JOIN FETCH p.dropRates LEFT JOIN FETCH p.guarantees WHERE p.active = true")
    List<Pack> findAllActiveWithRates();

    @Query("SELECT DISTINCT p FROM Pack p LEFT JOIN FETCH p.dropRates LEFT JOIN FETCH p.guarantees LEFT JOIN FETCH p.event WHERE p.code = :code")
    Optional<Pack> findByCodeWithRates(@Param("code") String code);

    @Query("SELECT DISTINCT p FROM Pack p LEFT JOIN FETCH p.dropRates LEFT JOIN FETCH p.guarantees ORDER BY p.createdAt DESC")
    List<Pack> findAllWithRates();
}
