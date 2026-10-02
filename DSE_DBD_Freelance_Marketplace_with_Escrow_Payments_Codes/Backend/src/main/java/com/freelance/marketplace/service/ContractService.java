package com.freelance.marketplace.service;

import java.util.List;
import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.freelance.marketplace.dto.ContractRequest;
import com.freelance.marketplace.entity.Contract;
import com.freelance.marketplace.entity.EscrowAccount;
import com.freelance.marketplace.entity.Milestone;
import com.freelance.marketplace.entity.Project;
import com.freelance.marketplace.entity.Proposal;
import com.freelance.marketplace.entity.ProposalStatus;
import com.freelance.marketplace.entity.Role;
import com.freelance.marketplace.entity.User;
import com.freelance.marketplace.exception.BadRequestException;
import com.freelance.marketplace.exception.ResourceNotFoundException;
import com.freelance.marketplace.repository.ContractRepository;
import com.freelance.marketplace.repository.EscrowAccountRepository;
import com.freelance.marketplace.repository.ProjectRepository;
import com.freelance.marketplace.repository.ProposalRepository;
import com.freelance.marketplace.repository.UserRepository;

@Service
public class ContractService {

    private final ContractRepository contractRepository;
    private final ProposalRepository proposalRepository;
    private final UserRepository userRepository;
    private final ProjectRepository projectRepository;
    private final EscrowAccountRepository escrowAccountRepository;

    public ContractService(ContractRepository contractRepository,
                          ProposalRepository proposalRepository,
                          UserRepository userRepository,
                          ProjectRepository projectRepository,
                          EscrowAccountRepository escrowAccountRepository) {
        this.contractRepository = contractRepository;
        this.proposalRepository = proposalRepository;
        this.userRepository = userRepository;
        this.projectRepository = projectRepository;
        this.escrowAccountRepository = escrowAccountRepository;
    }

    @Transactional
    public Contract createContract(User client, ContractRequest request) {
        User freelancer = userRepository.findById(request.getFreelancerId())
            .orElseThrow(() -> new ResourceNotFoundException("Freelancer not found with id " + request.getFreelancerId()));

        if (!Role.CLIENT.equals(client.getRole())) {
            throw new BadRequestException("Only clients can create contracts");
        }

        Project persistedProject = projectRepository.findById(request.getProjectId())
            .orElseThrow(() -> new ResourceNotFoundException("Project not found with id " + request.getProjectId()));
        if (!persistedProject.getClient().getId().equals(client.getId())) {
            throw new BadRequestException("You can only contract on your own projects");
        }

        Proposal acceptedProposal = proposalRepository.findFirstByProjectAndFreelancer(persistedProject, freelancer)
            .orElseThrow(() -> new BadRequestException("No matching approved proposal exists for this freelancer"));

        if (!ProposalStatus.ACCEPTED.equals(acceptedProposal.getStatus())) {
            throw new BadRequestException("This proposal is not currently accepted");
        }

        Contract existing = contractRepository.findByProject(persistedProject).orElse(null);
        if (existing != null) {
            throw new BadRequestException("A contract already exists for this project");
        }

        Contract contract = new Contract(persistedProject, client, freelancer, acceptedProposal.getBidAmount());
        contract = contractRepository.save(contract);
        BigDecimal total = contract.getContractAmount();
        BigDecimal firstAmount = total.multiply(new BigDecimal("0.25")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal secondAmount = total.multiply(new BigDecimal("0.50")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal finalAmount = total.subtract(firstAmount).subtract(secondAmount);
        contract.getMilestones().add(new Milestone(contract, "Project kickoff", firstAmount));
        contract.getMilestones().add(new Milestone(contract, "Core delivery", secondAmount));
        contract.getMilestones().add(new Milestone(contract, "Final review and handoff", finalAmount));
        contractRepository.save(contract);
        escrowAccountRepository.save(new EscrowAccount(contract));
        return contract;
    }

    public List<Contract> getContractsForUser(User user) {
        if (Role.CLIENT.equals(user.getRole())) {
            return contractRepository.findByClient(user);
        }
        return contractRepository.findByFreelancer(user);
    }

    public Contract getContractById(Long id) {
        return contractRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Contract not found with id " + id));
    }

    public void ensureUserCanAccessContract(User user, Long contractId) {
        Contract contract = getContractById(contractId);
        boolean allowed = contract.getClient().getId().equals(user.getId()) || contract.getFreelancer().getId().equals(user.getId());
        if (!allowed) {
            throw new BadRequestException("You do not have access to this contract");
        }
    }
}
