package com.freelance.marketplace.controller;

import com.freelance.marketplace.dto.ProposalRequest;
import com.freelance.marketplace.entity.Proposal;
import com.freelance.marketplace.entity.User;
import com.freelance.marketplace.repository.UserRepository;
import com.freelance.marketplace.service.ProposalService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/proposals")
public class ProposalController {

    private final ProposalService proposalService;
    private final UserRepository userRepository;

    public ProposalController(ProposalService proposalService, UserRepository userRepository) {
        this.proposalService = proposalService;
        this.userRepository = userRepository;
    }

    @PostMapping("/projects/{projectId}")
    public ResponseEntity<Proposal> submitProposal(@AuthenticationPrincipal UserDetails userDetails,
                                                 @PathVariable Long projectId,
                                                 @Valid @RequestBody ProposalRequest request) {
        User freelancer = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.status(HttpStatus.CREATED).body(proposalService.submitProposal(freelancer, projectId, request));
    }

    @GetMapping("/projects/{projectId}")
    public List<Proposal> proposalsForProject(@AuthenticationPrincipal UserDetails userDetails,
                                              @PathVariable Long projectId) {
        User client = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return proposalService.getProjectProposals(client, projectId);
    }

    @PostMapping("/{proposalId}/accept")
    public ResponseEntity<Proposal> acceptProposal(@AuthenticationPrincipal UserDetails userDetails,
                                                 @PathVariable Long proposalId) {
        User client = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(proposalService.acceptProposal(client, proposalId));
    }

    @PostMapping("/{proposalId}/reject")
    public ResponseEntity<Proposal> rejectProposal(@AuthenticationPrincipal UserDetails userDetails,
                                                 @PathVariable Long proposalId) {
        User client = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        Proposal proposal = proposalService.rejectProposal(client, proposalId);
        return ResponseEntity.ok(proposal);
    }

    @GetMapping("/me")
    public List<Proposal> myProposals(@AuthenticationPrincipal UserDetails userDetails) {
        User currentUser = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return proposalService.getProposalsForUser(currentUser);
    }
}
