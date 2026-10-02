package com.freelance.marketplace.repository;

import com.freelance.marketplace.entity.Notification;
import com.freelance.marketplace.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByRecipientOrderByCreatedAtDesc(User recipient);
    Optional<Notification> findByIdAndRecipient(Long id, User recipient);
}
