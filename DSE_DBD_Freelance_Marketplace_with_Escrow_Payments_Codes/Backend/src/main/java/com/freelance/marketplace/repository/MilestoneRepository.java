package com.freelance.marketplace.repository;

import com.freelance.marketplace.entity.Contract;
import com.freelance.marketplace.entity.Milestone;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MilestoneRepository extends JpaRepository<Milestone, Long> {
    List<Milestone> findByContract(Contract contract);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select milestone from Milestone milestone join fetch milestone.contract where milestone.id = :id")
    Optional<Milestone> findByIdForUpdate(@Param("id") Long id);
}
