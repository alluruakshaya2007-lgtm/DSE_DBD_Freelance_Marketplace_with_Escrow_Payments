package com.freelance.marketplace.service;

import com.freelance.marketplace.dto.EscrowFundingRequest;
import com.freelance.marketplace.entity.*;
import com.freelance.marketplace.exception.BadRequestException;
import com.freelance.marketplace.exception.ResourceNotFoundException;
import com.freelance.marketplace.repository.ContractRepository;
import com.freelance.marketplace.repository.EscrowAccountRepository;
import com.freelance.marketplace.repository.MilestoneRepository;
import com.freelance.marketplace.repository.MilestoneSubmissionRepository;
import com.freelance.marketplace.repository.PaymentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.io.IOException;
import java.util.List;
import java.util.UUID;

@Service
public class EscrowService {

    private static final long MAX_SUBMISSION_FILE_SIZE = 10 * 1024 * 1024;

    private final ContractRepository contractRepository;
    private final EscrowAccountRepository escrowAccountRepository;
    private final MilestoneRepository milestoneRepository;
    private final MilestoneSubmissionRepository milestoneSubmissionRepository;
    private final PaymentRepository paymentRepository;
    private final NotificationService notificationService;

    public EscrowService(ContractRepository contractRepository,
                        EscrowAccountRepository escrowAccountRepository,
                        MilestoneRepository milestoneRepository,
                        MilestoneSubmissionRepository milestoneSubmissionRepository,
                        PaymentRepository paymentRepository,
                        NotificationService notificationService) {
        this.contractRepository = contractRepository;
        this.escrowAccountRepository = escrowAccountRepository;
        this.milestoneRepository = milestoneRepository;
        this.milestoneSubmissionRepository = milestoneSubmissionRepository;
        this.paymentRepository = paymentRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public EscrowAccount fundEscrow(User client, EscrowFundingRequest request) {
        Contract contract = contractRepository.findById(request.getContractId())
            .orElseThrow(() -> new ResourceNotFoundException("Contract not found with id " + request.getContractId()));

        if (!contract.getClient().getId().equals(client.getId())) {
            throw new BadRequestException("Only the client can fund escrow");
        }

        if (contract.getStatus() == ContractStatus.COMPLETED || contract.getStatus() == ContractStatus.CANCELLED) {
            throw new BadRequestException("This contract cannot receive escrow funding");
        }

        EscrowAccount account = escrowAccountRepository.findByContractForUpdate(contract)
            .orElseGet(() -> escrowAccountRepository.save(new EscrowAccount(contract)));

        BigDecimal remainingContractAmount = contract.getContractAmount().subtract(account.getTotalAmount());
        if (request.getAmount().compareTo(remainingContractAmount) > 0) {
            throw new BadRequestException("Funding cannot exceed the contract amount");
        }

        BigDecimal newTotal = account.getTotalAmount().add(request.getAmount());
        BigDecimal newAvailable = account.getAvailableAmount().add(request.getAmount());
        account.setTotalAmount(newTotal);
        account.setAvailableAmount(newAvailable);
        account.setStatus(EscrowStatus.FUNDED);
        account.setUpdatedAt(java.time.Instant.now());
        EscrowAccount fundedAccount = escrowAccountRepository.save(account);
        notificationService.notify(contract.getFreelancer(), "The client funded escrow for " + contract.getProject().getTitle() + ".");
        return fundedAccount;
    }

    public EscrowAccount getEscrowAccount(User user, Long contractId) {
        Contract contract = contractRepository.findById(contractId)
            .orElseThrow(() -> new ResourceNotFoundException("Contract not found with id " + contractId));
        ensureParticipant(user, contract);
        return escrowAccountRepository.findByContract(contract)
            .orElseThrow(() -> new ResourceNotFoundException("Escrow account not found for contract " + contractId));
    }

    public List<Milestone> getMilestonesForContract(User user, Long contractId) {
        Contract contract = contractRepository.findById(contractId)
            .orElseThrow(() -> new ResourceNotFoundException("Contract not found with id " + contractId));
        ensureParticipant(user, contract);
        return milestoneRepository.findByContract(contract);
    }

    @Transactional
    public Milestone submitMilestone(User freelancer, Long milestoneId, MultipartFile file, String note) throws IOException {
        Milestone milestone = milestoneRepository.findByIdForUpdate(milestoneId)
            .orElseThrow(() -> new ResourceNotFoundException("Milestone not found with id " + milestoneId));

        if (!milestone.getContract().getFreelancer().getId().equals(freelancer.getId())) {
            throw new BadRequestException("Only the assigned freelancer can submit this milestone");
        }

        if (milestone.getStatus() != MilestoneStatus.PENDING && milestone.getStatus() != MilestoneStatus.REJECTED) {
            throw new BadRequestException("Only pending milestones or milestones needing changes can be submitted");
        }

        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Attach a deliverable file before submitting work");
        }
        if (file.getSize() > MAX_SUBMISSION_FILE_SIZE) {
            throw new BadRequestException("Deliverable files must be 10 MB or smaller");
        }
        String fileName = file.getOriginalFilename();
        if (fileName == null || fileName.isBlank()) {
            throw new BadRequestException("The deliverable file must have a name");
        }
        fileName = fileName.replace('\\', '/');
        fileName = fileName.substring(fileName.lastIndexOf('/') + 1).trim();
        if (fileName.isBlank() || fileName.length() > 255) {
            throw new BadRequestException("The deliverable file name must be between 1 and 255 characters");
        }
        if (note != null && note.length() > 2000) {
            throw new BadRequestException("Submission notes must be 2000 characters or fewer");
        }

        EscrowAccount account = escrowAccountRepository.findByContractForUpdate(milestone.getContract())
            .orElseThrow(() -> new ResourceNotFoundException("Escrow account not found for contract " + milestone.getContract().getId()));
        if (account.getAvailableAmount().compareTo(milestone.getAmount()) < 0) {
            throw new BadRequestException("Fund escrow for this milestone before submitting work");
        }

        milestone.setSubmissionFileName(fileName);
        milestone.setSubmissionFileSize(file.getSize());
        if (milestone.getSubmission() == null) {
            milestone.setSubmission(new MilestoneSubmission(milestone, file.getBytes()));
        } else {
            milestone.getSubmission().setFileData(file.getBytes());
        }
        milestone.setSubmissionNote(note == null || note.isBlank() ? null : note.trim());
        milestone.setReviewFeedback(null);
        milestone.setStatus(MilestoneStatus.SUBMITTED);
        milestone.setUpdatedAt(java.time.Instant.now());
        Milestone submittedMilestone = milestoneRepository.save(milestone);
        notificationService.notify(milestone.getContract().getClient(), milestone.getName() + " was submitted for review.");
        return submittedMilestone;
    }

    public MilestoneSubmission getMilestoneSubmission(User user, Long milestoneId) {
        MilestoneSubmission submission = milestoneSubmissionRepository.findByMilestoneId(milestoneId)
            .orElseThrow(() -> new ResourceNotFoundException("No deliverable has been submitted for this milestone"));
        ensureParticipant(user, submission.getMilestone().getContract());
        return submission;
    }

    @Transactional
    public Milestone approveMilestone(User client, Long milestoneId) {
        Milestone milestone = milestoneRepository.findByIdForUpdate(milestoneId)
            .orElseThrow(() -> new ResourceNotFoundException("Milestone not found with id " + milestoneId));

        if (!milestone.getContract().getClient().getId().equals(client.getId())) {
            throw new BadRequestException("Only the client can approve this milestone");
        }

        if (milestone.getStatus() != MilestoneStatus.SUBMITTED) {
            throw new BadRequestException("Only submitted milestones can be approved");
        }

        milestone.setStatus(MilestoneStatus.APPROVED);
        milestone.setUpdatedAt(java.time.Instant.now());
        Milestone approvedMilestone = milestoneRepository.save(milestone);
        notificationService.notify(milestone.getContract().getFreelancer(), milestone.getName() + " was approved.");
        return approvedMilestone;
    }

    @Transactional
    public Milestone requestMilestoneChanges(User client, Long milestoneId, String reason) {
        Milestone milestone = milestoneRepository.findByIdForUpdate(milestoneId)
            .orElseThrow(() -> new ResourceNotFoundException("Milestone not found with id " + milestoneId));

        if (!milestone.getContract().getClient().getId().equals(client.getId())) {
            throw new BadRequestException("Only the client can request milestone changes");
        }
        if (milestone.getStatus() != MilestoneStatus.SUBMITTED) {
            throw new BadRequestException("Changes can only be requested for submitted milestones");
        }
        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("Explain what needs to change before sending the work back");
        }
        if (reason.length() > 2000) {
            throw new BadRequestException("The change request must be 2000 characters or fewer");
        }

        milestone.setReviewFeedback(reason.trim());
        milestone.setStatus(MilestoneStatus.REJECTED);
        milestone.setUpdatedAt(java.time.Instant.now());
        Milestone returnedMilestone = milestoneRepository.save(milestone);
        notificationService.notify(milestone.getContract().getFreelancer(),
            "Changes were requested for " + milestone.getName() + ".");
        return returnedMilestone;
    }

    @Transactional
    public Payment releasePayment(User client, Long milestoneId) {
        Milestone milestone = milestoneRepository.findByIdForUpdate(milestoneId)
            .orElseThrow(() -> new ResourceNotFoundException("Milestone not found with id " + milestoneId));

        if (!milestone.getContract().getClient().getId().equals(client.getId())) {
            throw new BadRequestException("Only the client can release a payment");
        }

        if (milestone.getStatus() == MilestoneStatus.PAID) {
            throw new BadRequestException("This milestone payment has already been released");
        }

        if (milestone.getStatus() != MilestoneStatus.APPROVED) {
            throw new BadRequestException("This milestone cannot be released until it is approved");
        }

        Contract contract = milestone.getContract();
        EscrowAccount account = escrowAccountRepository.findByContractForUpdate(contract)
            .orElseThrow(() -> new ResourceNotFoundException("Escrow account not found for contract " + contract.getId()));

        if (account.getAvailableAmount().compareTo(milestone.getAmount()) < 0) {
            throw new BadRequestException("Escrow does not have enough funds for this payment");
        }

        account.setAvailableAmount(account.getAvailableAmount().subtract(milestone.getAmount()));
        if (account.getAvailableAmount().compareTo(BigDecimal.ZERO) <= 0
            && account.getTotalAmount().compareTo(contract.getContractAmount()) >= 0) {
            account.setStatus(EscrowStatus.RELEASED);
        } else {
            account.setStatus(EscrowStatus.PARTIALLY_RELEASED);
        }
        account.setUpdatedAt(java.time.Instant.now());
        escrowAccountRepository.save(account);

        Payment payment = new Payment(
            account,
            milestone,
            contract.getClient(),
            contract.getFreelancer(),
            milestone.getAmount(),
            "Simulated milestone payment release",
            "SIM-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase()
        );
        payment.setStatus(PaymentStatus.RELEASED);

        milestone.setStatus(MilestoneStatus.PAID);
        milestone.setUpdatedAt(java.time.Instant.now());
        milestoneRepository.save(milestone);
        if (milestoneRepository.findByContract(contract).stream()
            .allMatch(item -> item.getStatus() == MilestoneStatus.PAID)) {
            contract.setStatus(ContractStatus.COMPLETED);
            contract.setUpdatedAt(java.time.Instant.now());
            contract.getProject().setStatus(ProjectStatus.COMPLETED);
            contract.getProject().setUpdatedAt(java.time.Instant.now());
        }

        Payment releasedPayment = paymentRepository.save(payment);
        notificationService.notify(contract.getFreelancer(), "A payment was recorded for " + milestone.getName() + ".");
        return releasedPayment;
    }

    private void ensureParticipant(User user, Contract contract) {
        if (!contract.getClient().getId().equals(user.getId())
            && !contract.getFreelancer().getId().equals(user.getId())) {
            throw new BadRequestException("You do not have access to this contract");
        }
    }
}
