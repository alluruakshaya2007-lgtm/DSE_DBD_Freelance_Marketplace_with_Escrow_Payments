package com.freelance.marketplace.service;

import com.freelance.marketplace.entity.Notification;
import com.freelance.marketplace.entity.User;
import com.freelance.marketplace.exception.ResourceNotFoundException;
import com.freelance.marketplace.repository.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class NotificationService {
    private final NotificationRepository notificationRepository;

    public NotificationService(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Transactional
    public void notify(User recipient, String message) {
        notificationRepository.save(new Notification(recipient, message));
    }

    public List<Notification> getForUser(User user) {
        return notificationRepository.findByRecipientOrderByCreatedAtDesc(user);
    }

    @Transactional
    public Notification markRead(User user, Long notificationId) {
        Notification notification = notificationRepository.findByIdAndRecipient(notificationId, user)
            .orElseThrow(() -> new ResourceNotFoundException("Notification not found"));
        notification.setReadFlag(true);
        return notificationRepository.save(notification);
    }
}
