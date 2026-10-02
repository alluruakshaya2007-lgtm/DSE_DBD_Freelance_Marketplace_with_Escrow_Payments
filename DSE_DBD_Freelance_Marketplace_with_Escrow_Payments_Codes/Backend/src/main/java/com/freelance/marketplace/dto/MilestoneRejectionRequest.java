package com.freelance.marketplace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class MilestoneRejectionRequest {
    @NotBlank(message = "A reason is required when requesting changes")
    @Size(max = 2000, message = "The reason must be 2000 characters or fewer")
    private String reason;

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}
