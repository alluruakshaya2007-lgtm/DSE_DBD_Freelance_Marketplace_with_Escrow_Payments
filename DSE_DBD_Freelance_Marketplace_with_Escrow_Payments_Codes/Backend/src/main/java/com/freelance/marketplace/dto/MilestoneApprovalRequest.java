package com.freelance.marketplace.dto;

import jakarta.validation.constraints.NotNull;

public class MilestoneApprovalRequest {
    @NotNull(message = "Milestone ID is required")
    private Long milestoneId;

    public Long getMilestoneId() {
        return milestoneId;
    }

    public void setMilestoneId(Long milestoneId) {
        this.milestoneId = milestoneId;
    }
}
