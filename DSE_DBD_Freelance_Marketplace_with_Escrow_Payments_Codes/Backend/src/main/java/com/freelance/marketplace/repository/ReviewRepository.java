package com.freelance.marketplace.repository;

import com.freelance.marketplace.entity.Contract;
import com.freelance.marketplace.entity.Review;
import com.freelance.marketplace.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    List<Review> findByReviewee(User reviewee);
    List<Review> findByReviewer(User reviewer);
    boolean existsByContractAndReviewer(Contract contract, User reviewer);
}
