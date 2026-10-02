package com.freelance.marketplace.repository;

import com.freelance.marketplace.entity.MilestoneSubmission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface MilestoneSubmissionRepository extends JpaRepository<MilestoneSubmission, Long> {
    @Query("select submission from MilestoneSubmission submission " +
        "join fetch submission.milestone milestone join fetch milestone.contract " +
        "where milestone.id = :milestoneId")
    Optional<MilestoneSubmission> findByMilestoneId(@Param("milestoneId") Long milestoneId);
}
