package com.freelance.marketplace.service;

import com.freelance.marketplace.dto.DisputeRequest;
import com.freelance.marketplace.entity.Contract;
import com.freelance.marketplace.entity.ContractStatus;
import com.freelance.marketplace.entity.Dispute;
import com.freelance.marketplace.entity.User;
import com.freelance.marketplace.exception.BadRequestException;
import com.freelance.marketplace.exception.ResourceNotFoundException;
import com.freelance.marketplace.repository.ContractRepository;
import com.freelance.marketplace.repository.DisputeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class DisputeService {

    private final DisputeRepository disputeRepository;
    private final ContractRepository contractRepository;
    private final NotificationService notificationService;

    public DisputeService(DisputeRepository disputeRepository, ContractRepository contractRepository,
                          NotificationService notificationService) {
        this.disputeRepository = disputeRepository;
        this.contractRepository = contractRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public Dispute raiseDispute(User raisedBy, DisputeRequest request) {
        Contract contract = contractRepository.findById(request.getContractId())
            .orElseThrow(() -> new ResourceNotFoundException("Contract not found with id " + request.getContractId()));

        boolean allowed = contract.getClient().getId().equals(raisedBy.getId()) || contract.getFreelancer().getId().equals(raisedBy.getId());
        if (!allowed) {
            throw new BadRequestException("Only contract participants can raise a dispute");
        }

        if (contract.getStatus() != ContractStatus.ACTIVE) {
            throw new BadRequestException("A dispute can only be raised for an active contract");
        }

        Dispute dispute = disputeRepository.save(new Dispute(contract, raisedBy, request.getSubject(), request.getDescription()));
        User otherParty = contract.getClient().getId().equals(raisedBy.getId())
            ? contract.getFreelancer()
            : contract.getClient();
        notificationService.notify(otherParty, "A dispute was raised for " + contract.getProject().getTitle() + ".");
        return dispute;
    }

    public List<Dispute> getDisputesForUser(User user) {
        List<Contract> contracts = new java.util.ArrayList<>(contractRepository.findByClient(user));
        contracts.addAll(contractRepository.findByFreelancer(user));
        return contracts.stream()
            .flatMap(contract -> disputeRepository.findByContract(contract).stream())
            .distinct()
            .sorted(java.util.Comparator.comparing(Dispute::getCreatedAt).reversed())
            .toList();
    }
}
