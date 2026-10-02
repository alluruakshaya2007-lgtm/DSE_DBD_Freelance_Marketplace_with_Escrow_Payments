package com.freelance.marketplace.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class EscrowFundingRequest {
    @NotNull(message = "Contract ID is required")
    private Long contractId;

    @NotNull(message = "Funding amount is required")
    @DecimalMin(value = "0.01", inclusive = true, message = "Funding amount must be greater than zero")
    private BigDecimal amount;

    public Long getContractId() {
        return contractId;
    }

    public void setContractId(Long contractId) {
        this.contractId = contractId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }
}
