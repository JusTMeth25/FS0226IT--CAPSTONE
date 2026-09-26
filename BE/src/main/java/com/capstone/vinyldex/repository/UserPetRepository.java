package com.capstone.vinyldex.repository;

import com.capstone.vinyldex.entity.UserPet;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserPetRepository extends JpaRepository<UserPet, UUID> {
}
