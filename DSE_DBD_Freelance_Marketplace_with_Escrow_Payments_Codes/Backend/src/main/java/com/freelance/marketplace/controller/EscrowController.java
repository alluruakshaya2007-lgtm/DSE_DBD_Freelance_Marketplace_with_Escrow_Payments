package com.freelance.marketplace.controller;

import com.freelance.marketplace.dto.EscrowFundingRequest;
import com.freelance.marketplace.dto.MilestoneApprovalRequest;
import com.freelance.marketplace.dto.MilestoneRejectionRequest;
import com.freelance.marketplace.entity.EscrowAccount;
import com.freelance.marketplace.entity.Milestone;
import com.freelance.marketplace.entity.MilestoneSubmission;
import com.freelance.marketplace.entity.Payment;
import com.freelance.marketplace.entity.User;
import com.freelance.marketplace.repository.UserRepository;
import com.freelance.marketplace.service.EscrowService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/escrow")
public class EscrowController {

    private final EscrowService escrowService;
    private final UserRepository userRepository;

    public EscrowController(EscrowService escrowService, UserRepository userRepository) {
        this.escrowService = escrowService;
        this.userRepository = userRepository;
    }

    @PostMapping("/fund")
    public ResponseEntity<EscrowAccount> fundEscrow(@AuthenticationPrincipal UserDetails userDetails,
                                                  @Valid @RequestBody EscrowFundingRequest request) {
        User client = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(escrowService.fundEscrow(client, request));
    }

    @GetMapping("/contracts/{contractId}")
    public ResponseEntity<EscrowAccount> getEscrow(@AuthenticationPrincipal UserDetails userDetails,
                                                   @PathVariable Long contractId) {
        User user = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(escrowService.getEscrowAccount(user, contractId));
    }

    @GetMapping("/contracts/{contractId}/milestones")
    public ResponseEntity<List<Milestone>> getMilestones(@AuthenticationPrincipal UserDetails userDetails,
                                                         @PathVariable Long contractId) {
        User user = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(escrowService.getMilestonesForContract(user, contractId));
    }

    @PostMapping("/milestones/{milestoneId}/submit")
    public ResponseEntity<Milestone> submitMilestone(@AuthenticationPrincipal UserDetails userDetails,
                                                    @PathVariable Long milestoneId,
                                                    @RequestPart("file") MultipartFile file,
                                                    @RequestParam(required = false) String note) throws IOException {
        User freelancer = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(escrowService.submitMilestone(freelancer, milestoneId, file, note));
    }

    @GetMapping("/milestones/{milestoneId}/submission")
    public ResponseEntity<byte[]> downloadSubmission(@AuthenticationPrincipal UserDetails userDetails,
                                                    @PathVariable Long milestoneId) {
        User user = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        MilestoneSubmission submission = escrowService.getMilestoneSubmission(user, milestoneId);
        ContentDisposition disposition = ContentDisposition.attachment()
            .filename(submission.getMilestone().getSubmissionFileName(), StandardCharsets.UTF_8)
            .build();
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .contentLength(submission.getFileData().length)
            .body(submission.getFileData());
    }

    @PostMapping("/milestones/{milestoneId}/approve")
    public ResponseEntity<Milestone> approveMilestone(@AuthenticationPrincipal UserDetails userDetails,
                                                     @PathVariable Long milestoneId) {
        User client = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(escrowService.approveMilestone(client, milestoneId));
    }

    @PostMapping("/milestones/{milestoneId}/request-changes")
    public ResponseEntity<Milestone> requestMilestoneChanges(@AuthenticationPrincipal UserDetails userDetails,
                                                             @PathVariable Long milestoneId,
                                                             @Valid @RequestBody MilestoneRejectionRequest request) {
        User client = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(escrowService.requestMilestoneChanges(client, milestoneId, request.getReason()));
    }

    @PostMapping("/milestones/{milestoneId}/release")
    public ResponseEntity<Payment> releasePayment(@AuthenticationPrincipal UserDetails userDetails,
                                                @PathVariable Long milestoneId) {
        User client = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(escrowService.releasePayment(client, milestoneId));
    }
}
