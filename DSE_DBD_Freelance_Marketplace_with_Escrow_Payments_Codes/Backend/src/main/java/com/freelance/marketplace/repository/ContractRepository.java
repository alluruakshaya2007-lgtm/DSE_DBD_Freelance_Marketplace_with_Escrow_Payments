package com.freelance.marketplace.repository;

import com.freelance.marketplace.entity.Contract;
import com.freelance.marketplace.entity.ContractStatus;
import com.freelance.marketplace.entity.Project;
import com.freelance.marketplace.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContractRepository extends JpaRepository<Contract, Long> {
    List<Contract> findByClient(User client);
    List<Contract> findByFreelancer(User freelancer);
    Optional<Contract> findByProject(Project project);
    boolean existsByClientAndFreelancer(User client, User freelancer);
    List<Contract> findByStatus(ContractStatus status);
}
