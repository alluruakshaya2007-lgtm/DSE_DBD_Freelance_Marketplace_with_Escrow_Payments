package com.freelance.marketplace.repository;

import com.freelance.marketplace.entity.Message;
import com.freelance.marketplace.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findBySenderOrReceiverOrderByCreatedAtAsc(User sender, User receiver);
    List<Message> findByConversationIdOrderByCreatedAtAsc(String conversationId);
}
