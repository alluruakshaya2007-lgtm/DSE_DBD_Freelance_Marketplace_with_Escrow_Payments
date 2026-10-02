package com.freelance.marketplace.repository;

import com.freelance.marketplace.entity.Contract;
import com.freelance.marketplace.entity.EscrowAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface EscrowAccountRepository extends JpaRepository<EscrowAccount, Long> {
    Optional<EscrowAccount> findByContract(Contract contract);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select account from EscrowAccount account where account.contract = :contract")
    Optional<EscrowAccount> findByContractForUpdate(@Param("contract") Contract contract);
}
