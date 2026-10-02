package com.freelance.marketplace.repository;

import com.freelance.marketplace.entity.Contract;
import com.freelance.marketplace.entity.Dispute;
import com.freelance.marketplace.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DisputeRepository extends JpaRepository<Dispute, Long> {
    List<Dispute> findByRaisedBy(User raisedBy);
    List<Dispute> findByContract(Contract contract);
}
