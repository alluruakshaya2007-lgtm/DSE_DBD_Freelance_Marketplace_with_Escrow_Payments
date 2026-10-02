package com.freelance.marketplace.dto;

import jakarta.validation.constraints.NotNull;

public class ContractRequest {
    @NotNull(message = "Project ID is required")
    private Long projectId;

    @NotNull(message = "Freelancer ID is required")
    private Long freelancerId;

    public Long getProjectId() {
        return projectId;
    }

    public void setProjectId(Long projectId) {
        this.projectId = projectId;
    }

    public Long getFreelancerId() {
        return freelancerId;
    }

    public void setFreelancerId(Long freelancerId) {
        this.freelancerId = freelancerId;
    }
}
