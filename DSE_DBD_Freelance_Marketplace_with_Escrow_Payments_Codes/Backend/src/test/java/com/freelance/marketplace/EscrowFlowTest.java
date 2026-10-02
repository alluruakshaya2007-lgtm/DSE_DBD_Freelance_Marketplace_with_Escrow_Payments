package com.freelance.marketplace;

import com.freelance.marketplace.dto.EscrowFundingRequest;
import com.freelance.marketplace.entity.*;
import com.freelance.marketplace.exception.BadRequestException;
import com.freelance.marketplace.repository.*;
import com.freelance.marketplace.service.EscrowService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.mock.web.MockMultipartFile;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@Transactional
@ActiveProfiles("h2")
class EscrowFlowTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ContractRepository contractRepository;

    @Autowired
    private EscrowAccountRepository escrowAccountRepository;

    @Autowired
    private MilestoneRepository milestoneRepository;

    @Autowired
    private EscrowService escrowService;

    @Test
    void fundingAndMilestoneReleaseShouldUpdateEscrowAndPayment() {
        User client = new User("Client One", "client-one@example.com", "pass123", Role.CLIENT, "CO", "Test client");
        User freelancer = new User("Freelancer One", "freelancer-one@example.com", "pass123", Role.FREELANCER, "FO", "Test freelancer");
        userRepository.saveAll(List.of(client, freelancer));

        Project project = new Project("Website Build", "Need a landing page", "Web Development", new BigDecimal("1000"), "30 Sep 2026", List.of("React"), client);
        projectRepository.save(project);

        Contract contract = new Contract(project, client, freelancer, new BigDecimal("1000"));
        contract = contractRepository.save(contract);

        EscrowAccount account = new EscrowAccount(contract);
        account.setTotalAmount(BigDecimal.ZERO);
        account.setAvailableAmount(BigDecimal.ZERO);
        escrowAccountRepository.save(account);

        EscrowFundingRequest fundingRequest = new EscrowFundingRequest();
        fundingRequest.setContractId(contract.getId());
        fundingRequest.setAmount(new BigDecimal("500"));

        EscrowAccount funded = escrowService.fundEscrow(client, fundingRequest);
        assertEquals(new BigDecimal("500"), funded.getAvailableAmount());

        Milestone milestone = new Milestone(contract, "Landing page design", new BigDecimal("500"));
        milestoneRepository.save(milestone);

        milestone.setStatus(MilestoneStatus.APPROVED);
        milestoneRepository.save(milestone);

        Payment payment = escrowService.releasePayment(client, milestone.getId());
        assertEquals(PaymentStatus.RELEASED, payment.getStatus());
        assertEquals(MilestoneStatus.PAID, milestoneRepository.findById(milestone.getId()).orElseThrow().getStatus());
    }

    @Test
    void freelancerCanSubmitAndContractParticipantsCanDownloadDeliverable() throws Exception {
        User client = new User("Client Two", "client-two@example.com", "pass123", Role.CLIENT, "CT", "Test client");
        User freelancer = new User("Freelancer Two", "freelancer-two@example.com", "pass123", Role.FREELANCER, "FT", "Test freelancer");
        User unrelated = new User("Unrelated User", "unrelated@example.com", "pass123", Role.CLIENT, "UU", "Not a participant");
        userRepository.saveAll(List.of(client, freelancer, unrelated));

        Project project = new Project("Deliverable Test", "A project for testing milestone file submissions", "Web Development",
            new BigDecimal("1000"), "30 Nov 2026", List.of("React"), client);
        projectRepository.save(project);
        Contract contract = contractRepository.save(new Contract(project, client, freelancer, new BigDecimal("1000")));
        EscrowAccount escrow = new EscrowAccount(contract);
        escrow.setTotalAmount(new BigDecimal("1000"));
        escrow.setAvailableAmount(new BigDecimal("1000"));
        escrowAccountRepository.save(escrow);
        Milestone milestone = milestoneRepository.save(new Milestone(contract, "Initial delivery", new BigDecimal("500")));
        MockMultipartFile file = new MockMultipartFile("file", "deliverable.txt", "text/plain",
            "Synthetic project deliverable".getBytes(StandardCharsets.UTF_8));

        Milestone submitted = escrowService.submitMilestone(freelancer, milestone.getId(), file, "Ready for review");
        MilestoneSubmission download = escrowService.getMilestoneSubmission(client, milestone.getId());

        assertEquals(MilestoneStatus.SUBMITTED, submitted.getStatus());
        assertEquals("deliverable.txt", submitted.getSubmissionFileName());
        assertEquals("Ready for review", submitted.getSubmissionNote());
        assertArrayEquals(file.getBytes(), download.getFileData());
        assertThrows(BadRequestException.class,
            () -> escrowService.getMilestoneSubmission(unrelated, milestone.getId()));

        Milestone returned = escrowService.requestMilestoneChanges(client, milestone.getId(), "Please include the mobile layout.");
        assertEquals(MilestoneStatus.REJECTED, returned.getStatus());
        assertEquals("Please include the mobile layout.", returned.getReviewFeedback());

        MockMultipartFile revisedFile = new MockMultipartFile("file", "revised-deliverable.txt", "text/plain",
            "Revised project deliverable".getBytes(StandardCharsets.UTF_8));
        Milestone resubmitted = escrowService.submitMilestone(freelancer, milestone.getId(), revisedFile, "Mobile layout added");
        assertEquals(MilestoneStatus.SUBMITTED, resubmitted.getStatus());
        assertNull(resubmitted.getReviewFeedback());
    }
}
