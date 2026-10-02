package com.freelance.marketplace.repository;

import com.freelance.marketplace.entity.Project;
import com.freelance.marketplace.entity.Proposal;
import com.freelance.marketplace.entity.ProposalStatus;
import com.freelance.marketplace.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProposalRepository extends JpaRepository<Proposal, Long> {
    List<Proposal> findByProject(Project project);
    List<Proposal> findByProject_Client(User client);
    List<Proposal> findByFreelancer(User freelancer);
    Optional<Proposal> findFirstByProjectAndFreelancer(Project project, User freelancer);
    boolean existsByProject_ClientAndFreelancer(User client, User freelancer);
    List<Proposal> findByProjectAndStatus(Project project, ProposalStatus status);
}
