package com.freelance.marketplace.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "milestone_submissions")
public class MilestoneSubmission {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "milestone_id", nullable = false, unique = true)
    private Milestone milestone;

    @Lob
    @JsonIgnore
    @Column(nullable = false)
    private byte[] fileData;

    protected MilestoneSubmission() {
    }

    public MilestoneSubmission(Milestone milestone, byte[] fileData) {
        this.milestone = milestone;
        this.fileData = fileData;
    }

    public Long getId() {
        return id;
    }

    public Milestone getMilestone() {
        return milestone;
    }

    public byte[] getFileData() {
        return fileData;
    }

    public void setFileData(byte[] fileData) {
        this.fileData = fileData;
    }
}
