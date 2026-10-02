package com.freelance.marketplace.repository;

import com.freelance.marketplace.entity.Contract;
import com.freelance.marketplace.entity.EscrowAccount;
import com.freelance.marketplace.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByEscrowAccount(EscrowAccount escrowAccount);
    List<Payment> findByEscrowAccountOrderByCreatedAtDesc(EscrowAccount escrowAccount);
    List<Payment> findByEscrowAccount_Contract(Contract contract);
}
