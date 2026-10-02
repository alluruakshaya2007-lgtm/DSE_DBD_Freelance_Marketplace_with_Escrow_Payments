package com.freelance.marketplace.controller;

import com.freelance.marketplace.dto.MessageRequest;
import com.freelance.marketplace.entity.Message;
import com.freelance.marketplace.entity.User;
import com.freelance.marketplace.repository.UserRepository;
import com.freelance.marketplace.service.MessageService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final MessageService messageService;
    private final UserRepository userRepository;

    public MessageController(MessageService messageService, UserRepository userRepository) {
        this.messageService = messageService;
        this.userRepository = userRepository;
    }

    @GetMapping("/contacts")
    public List<User> contacts(@AuthenticationPrincipal UserDetails userDetails) {
        User currentUser = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return messageService.getContactsForUser(currentUser);
    }

    @GetMapping("/conversation/{otherUserId}")
    public List<Message> conversation(@AuthenticationPrincipal UserDetails userDetails, @PathVariable Long otherUserId) {
        User currentUser = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return messageService.getConversation(currentUser, otherUserId);
    }

    @PostMapping
    public ResponseEntity<Message> sendMessage(@AuthenticationPrincipal UserDetails userDetails,
                                              @Valid @RequestBody MessageRequest request) {
        User sender = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(messageService.sendMessage(sender, request.getReceiverId(), request.getText()));
    }
}
