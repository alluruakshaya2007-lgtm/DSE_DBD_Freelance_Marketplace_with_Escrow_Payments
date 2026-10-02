package com.freelance.marketplace.controller;

import com.freelance.marketplace.dto.ContractRequest;
import com.freelance.marketplace.entity.Contract;
import com.freelance.marketplace.entity.User;
import com.freelance.marketplace.repository.UserRepository;
import com.freelance.marketplace.service.ContractService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/contracts")
public class ContractController {

    private final ContractService contractService;
    private final UserRepository userRepository;

    public ContractController(ContractService contractService, UserRepository userRepository) {
        this.contractService = contractService;
        this.userRepository = userRepository;
    }

    @PostMapping
    public ResponseEntity<Contract> createContract(@AuthenticationPrincipal UserDetails userDetails,
                                                 @Valid @RequestBody ContractRequest request) {
        User client = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.status(HttpStatus.CREATED).body(contractService.createContract(client, request));
    }

    @GetMapping
    public List<Contract> getContracts(@AuthenticationPrincipal UserDetails userDetails) {
        User currentUser = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return contractService.getContractsForUser(currentUser);
    }
}
