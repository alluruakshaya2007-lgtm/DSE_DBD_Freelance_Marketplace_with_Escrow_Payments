package com.freelance.marketplace.service;

import com.freelance.marketplace.entity.Message;
import com.freelance.marketplace.entity.Role;
import com.freelance.marketplace.entity.User;
import com.freelance.marketplace.exception.BadRequestException;
import com.freelance.marketplace.exception.ResourceNotFoundException;
import com.freelance.marketplace.repository.MessageRepository;
import com.freelance.marketplace.repository.ContractRepository;
import com.freelance.marketplace.repository.ProposalRepository;
import com.freelance.marketplace.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class MessageService {

    private final MessageRepository messageRepository;
    private final UserRepository userRepository;
    private final ContractRepository contractRepository;
    private final ProposalRepository proposalRepository;
    private final NotificationService notificationService;

    public MessageService(MessageRepository messageRepository, UserRepository userRepository,
                          ContractRepository contractRepository, ProposalRepository proposalRepository,
                          NotificationService notificationService) {
        this.messageRepository = messageRepository;
        this.userRepository = userRepository;
        this.contractRepository = contractRepository;
        this.proposalRepository = proposalRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public Message sendMessage(User sender, Long receiverId, String text) {
        if (text == null || text.isBlank()) {
            throw new BadRequestException("Message text is required");
        }

        User receiver = userRepository.findById(receiverId)
            .orElseThrow(() -> new ResourceNotFoundException("Receiver not found with id " + receiverId));
        if (sender.getId().equals(receiver.getId())) {
            throw new BadRequestException("You cannot send a message to yourself");
        }
        User client = Role.CLIENT.equals(sender.getRole()) ? sender : receiver;
        User freelancer = Role.FREELANCER.equals(sender.getRole()) ? sender : receiver;
        if (!hasMarketplaceRelationship(client, freelancer)) {
            throw new BadRequestException("You can only message a client or freelancer connected to your project");
        }

        String conversationId = buildConversationId(sender.getId(), receiver.getId());
        Message message = new Message(sender, receiver, conversationId, text.trim());
        Message savedMessage = messageRepository.save(message);
        notificationService.notify(receiver, "New message from " + sender.getName() + ".");
        return savedMessage;
    }

    public List<Message> getConversation(User currentUser, Long otherUserId) {
        User otherUser = userRepository.findById(otherUserId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found with id " + otherUserId));

        if (currentUser.getId().equals(otherUser.getId())) {
            throw new BadRequestException("You cannot open a conversation with yourself");
        }
        if (!canMessage(currentUser, otherUser)) {
            throw new BadRequestException("You can only read conversations with a client or freelancer connected to your project");
        }

        String conversationId = buildConversationId(currentUser.getId(), otherUser.getId());
        return messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId)
            .stream()
            .sorted(Comparator.comparing(Message::getCreatedAt))
            .toList();
    }

    public List<User> getContactsForUser(User user) {
        Map<Long, User> contacts = new LinkedHashMap<>();

        // Counterparties the user is already connected to through the marketplace,
        // so a conversation can be started before any message exists.
        contractRepository.findByClient(user).forEach(contract -> contacts.put(contract.getFreelancer().getId(), contract.getFreelancer()));
        contractRepository.findByFreelancer(user).forEach(contract -> contacts.put(contract.getClient().getId(), contract.getClient()));

        proposalRepository.findByFreelancer(user).forEach(proposal -> contacts.put(proposal.getProject().getClient().getId(), proposal.getProject().getClient()));
        proposalRepository.findByProject_Client(user).forEach(proposal -> contacts.put(proposal.getFreelancer().getId(), proposal.getFreelancer()));

        // Anyone already exchanged messages, even outside a current contract.
        messageRepository.findBySenderOrReceiverOrderByCreatedAtAsc(user, user)
            .forEach(message -> {
                User other = message.getSender().getId().equals(user.getId()) ? message.getReceiver() : message.getSender();
                contacts.putIfAbsent(other.getId(), other);
            });

        return new ArrayList<>(contacts.values());
    }

    private boolean canMessage(User sender, User receiver) {
        User client = Role.CLIENT.equals(sender.getRole()) ? sender : receiver;
        User freelancer = Role.FREELANCER.equals(sender.getRole()) ? sender : receiver;
        return hasMarketplaceRelationship(client, freelancer);
    }

    private boolean hasMarketplaceRelationship(User client, User freelancer) {
        return Role.CLIENT.equals(client.getRole())
            && Role.FREELANCER.equals(freelancer.getRole())
            && (contractRepository.existsByClientAndFreelancer(client, freelancer)
                || proposalRepository.existsByProject_ClientAndFreelancer(client, freelancer));
    }

    private String buildConversationId(Long first, Long second) {        long low = Math.min(first, second);
        long high = Math.max(first, second);
        return low + "-" + high;
    }
}
