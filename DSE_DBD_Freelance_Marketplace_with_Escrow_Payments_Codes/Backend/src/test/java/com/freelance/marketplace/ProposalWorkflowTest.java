package com.freelance.marketplace;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.freelance.marketplace.entity.*;
import com.freelance.marketplace.repository.*;
import com.freelance.marketplace.service.ProposalService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@Transactional
@ActiveProfiles("h2")
class ProposalWorkflowTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ProposalRepository proposalRepository;

    @Autowired
    private ContractRepository contractRepository;

    @Autowired
    private EscrowAccountRepository escrowAccountRepository;

    @Autowired
    private ProposalService proposalService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void clientCanReviewProposalsAndAcceptingCreatesPersistentMilestonesAndEscrow() {
        User client = userRepository.save(new User(
            "Workflow Client", "workflow-client@example.com", "password", Role.CLIENT, null, null));
        User selectedFreelancer = userRepository.save(new User(
            "Selected Freelancer", "selected-freelancer@example.com", "password", Role.FREELANCER, null, null));
        User otherFreelancer = userRepository.save(new User(
            "Other Freelancer", "other-freelancer@example.com", "password", Role.FREELANCER, null, null));
        Project project = projectRepository.save(new Project(
            "Marketplace workflow", "Persistent contract flow", "Web Development",
            new BigDecimal("1500.00"), "2026-12-30", List.of("React"), client));
        Proposal selectedProposal = proposalRepository.save(new Proposal(
            project, selectedFreelancer, new BigDecimal("101.01"), 7, "Ready to deliver"));
        Proposal competingProposal = proposalRepository.save(new Proposal(
            project, otherFreelancer, new BigDecimal("120.00"), 9, "Available soon"));

        assertEquals(2, proposalService.getProposalsForUser(client).size());
        assertEquals(1, proposalService.getProposalsForUser(selectedFreelancer).size());

        proposalService.acceptProposal(client, selectedProposal.getId());

        Contract contract = contractRepository.findByProject(project).orElseThrow();
        assertEquals(ContractStatus.ACTIVE, contract.getStatus());
        assertEquals(3, contract.getMilestones().size());
        assertEquals(new BigDecimal("101.01"), contract.getMilestones().stream()
            .map(Milestone::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add));
        assertEquals(ProposalStatus.ACCEPTED,
            proposalRepository.findById(selectedProposal.getId()).orElseThrow().getStatus());
        assertEquals(ProposalStatus.REJECTED,
            proposalRepository.findById(competingProposal.getId()).orElseThrow().getStatus());
        assertTrue(escrowAccountRepository.findByContract(contract).isPresent());

        JsonNode serializedContract = objectMapper.valueToTree(contract);
        assertEquals(3, serializedContract.path("milestones").size());
        assertFalse(serializedContract.path("milestones").get(0).has("contract"));
    }
}
