package com.freelance.marketplace.service;

import com.freelance.marketplace.dto.ProposalRequest;
import com.freelance.marketplace.entity.Contract;
import com.freelance.marketplace.entity.ContractStatus;
import com.freelance.marketplace.entity.EscrowAccount;
import com.freelance.marketplace.entity.EscrowStatus;
import com.freelance.marketplace.entity.Milestone;
import com.freelance.marketplace.entity.Project;
import com.freelance.marketplace.entity.ProjectStatus;
import com.freelance.marketplace.entity.Proposal;
import com.freelance.marketplace.entity.ProposalStatus;
import com.freelance.marketplace.entity.Role;
import com.freelance.marketplace.entity.User;
import com.freelance.marketplace.exception.BadRequestException;
import com.freelance.marketplace.exception.ResourceNotFoundException;
import com.freelance.marketplace.repository.ContractRepository;
import com.freelance.marketplace.repository.EscrowAccountRepository;
import com.freelance.marketplace.repository.ProposalRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
public class ProposalService {

    private final ProposalRepository proposalRepository;
    private final ProjectService projectService;
    private final ContractRepository contractRepository;
    private final EscrowAccountRepository escrowAccountRepository;
    private final NotificationService notificationService;

    public ProposalService(ProposalRepository proposalRepository,
                          ProjectService projectService,
                          ContractRepository contractRepository,
                          EscrowAccountRepository escrowAccountRepository,
                          NotificationService notificationService) {
        this.proposalRepository = proposalRepository;
        this.projectService = projectService;
        this.contractRepository = contractRepository;
        this.escrowAccountRepository = escrowAccountRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public Proposal submitProposal(User freelancer, Long projectId, ProposalRequest request) {
        if (!Role.FREELANCER.equals(freelancer.getRole())) {
            throw new BadRequestException("Only freelancers can submit proposals");
        }

        Project project = projectService.getProjectById(projectId);
        if (project.getClient().getId().equals(freelancer.getId())) {
            throw new BadRequestException("You cannot submit a proposal to your own project");
        }

        if (proposalRepository.findFirstByProjectAndFreelancer(project, freelancer).isPresent()) {
            throw new BadRequestException("You have already submitted a proposal for this project");
        }

        Proposal proposal = new Proposal(project, freelancer, request.getBidAmount(), request.getEstimatedDays(), request.getCoverLetter());
        Proposal savedProposal = proposalRepository.save(proposal);
        notificationService.notify(project.getClient(), "A new proposal was submitted for " + project.getTitle() + ".");
        return savedProposal;
    }

    public List<Proposal> getProjectProposals(User client, Long projectId) {
        if (!Role.CLIENT.equals(client.getRole())) {
            throw new BadRequestException("Only clients can review project proposals");
        }
        Project project = projectService.getProjectById(projectId);
        if (!project.getClient().getId().equals(client.getId())) {
            throw new BadRequestException("You can only review proposals for your own projects");
        }
        return proposalRepository.findByProject(project);
    }

    public List<Proposal> getFreelancerProposals(User freelancer) {
        return proposalRepository.findByFreelancer(freelancer);
    }

    public List<Proposal> getProposalsForUser(User user) {
        return Role.CLIENT.equals(user.getRole())
            ? proposalRepository.findByProject_Client(user)
            : proposalRepository.findByFreelancer(user);
    }

    @Transactional
    public Proposal acceptProposal(User client, Long proposalId) {
        Proposal proposal = proposalRepository.findById(proposalId)
            .orElseThrow(() -> new ResourceNotFoundException("Proposal not found with id " + proposalId));

        if (!proposal.getProject().getClient().getId().equals(client.getId())) {
            throw new BadRequestException("Only the client can accept a proposal");
        }

        if (ProposalStatus.ACCEPTED.equals(proposal.getStatus())) {
            return proposal;
        }
        if (proposal.getStatus() == ProposalStatus.REJECTED || proposal.getStatus() == ProposalStatus.WITHDRAWN) {
            throw new BadRequestException("This proposal can no longer be accepted");
        }

        proposal.setStatus(ProposalStatus.ACCEPTED);
        Project project = proposal.getProject();
        project.setStatus(ProjectStatus.IN_PROGRESS);
        project.setUpdatedAt(java.time.Instant.now());
        proposalRepository.save(proposal);

        if (contractRepository.findByProject(project).isEmpty()) {
            Contract contract = new Contract(project, client, proposal.getFreelancer(), proposal.getBidAmount());
            contract.setStatus(ContractStatus.ACTIVE);
            contract.setTotalAmount(proposal.getBidAmount() == null ? BigDecimal.ZERO : proposal.getBidAmount());
            Contract savedContract = contractRepository.save(contract);

            BigDecimal total = proposal.getBidAmount();
            BigDecimal firstAmount = total.multiply(new BigDecimal("0.25")).setScale(2, RoundingMode.HALF_UP);
            BigDecimal secondAmount = total.multiply(new BigDecimal("0.50")).setScale(2, RoundingMode.HALF_UP);
            BigDecimal finalAmount = total.subtract(firstAmount).subtract(secondAmount);
            savedContract.getMilestones().add(new Milestone(savedContract, "Project kickoff", firstAmount));
            savedContract.getMilestones().add(new Milestone(savedContract, "Core delivery", secondAmount));
            savedContract.getMilestones().add(new Milestone(savedContract, "Final review and handoff", finalAmount));
            contractRepository.save(savedContract);

            EscrowAccount escrowAccount = new EscrowAccount(savedContract);
            escrowAccount.setTotalAmount(BigDecimal.ZERO);
            escrowAccount.setAvailableAmount(BigDecimal.ZERO);
            escrowAccount.setStatus(EscrowStatus.NOT_FUNDED);
            escrowAccountRepository.save(escrowAccount);
        }

        proposalRepository.findByProject(project).stream()
            .filter(other -> !other.getId().equals(proposal.getId()))
            .filter(other -> other.getStatus() != ProposalStatus.ACCEPTED)
            .forEach(other -> {
                other.setStatus(ProposalStatus.REJECTED);
                other.setUpdatedAt(java.time.Instant.now());
            });
        notificationService.notify(proposal.getFreelancer(), "Your proposal for " + project.getTitle() + " was accepted.");
        return proposal;
    }

    @Transactional
    public Proposal rejectProposal(User client, Long proposalId) {
        Proposal proposal = proposalRepository.findById(proposalId)
            .orElseThrow(() -> new ResourceNotFoundException("Proposal not found with id " + proposalId));

        if (!proposal.getProject().getClient().getId().equals(client.getId())) {
            throw new BadRequestException("Only the client can reject a proposal");
        }

        if (proposal.getStatus() == ProposalStatus.ACCEPTED) {
            throw new BadRequestException("An accepted proposal cannot be rejected");
        }
        proposal.setStatus(ProposalStatus.REJECTED);
        proposal.setUpdatedAt(java.time.Instant.now());
        Proposal rejectedProposal = proposalRepository.save(proposal);
        notificationService.notify(proposal.getFreelancer(), "Your proposal for " + proposal.getProject().getTitle() + " was declined.");
        return rejectedProposal;
    }
}
