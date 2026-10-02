package com.freelance.marketplace.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public class ProposalRequest {
    @NotNull(message = "Bid amount is required")
    @DecimalMin(value = "0.01", inclusive = true, message = "Bid amount must be greater than zero")
    private BigDecimal bidAmount;

    @NotNull(message = "Estimated delivery days are required")
    private Integer estimatedDays;

    @NotBlank(message = "Cover letter is required")
    private String coverLetter;

    public BigDecimal getBidAmount() {
        return bidAmount;
    }

    public void setBidAmount(BigDecimal bidAmount) {
        this.bidAmount = bidAmount;
    }

    public Integer getEstimatedDays() {
        return estimatedDays;
    }

    public void setEstimatedDays(Integer estimatedDays) {
        this.estimatedDays = estimatedDays;
    }

    public String getCoverLetter() {
        return coverLetter;
    }

    public void setCoverLetter(String coverLetter) {
        this.coverLetter = coverLetter;
    }
}
