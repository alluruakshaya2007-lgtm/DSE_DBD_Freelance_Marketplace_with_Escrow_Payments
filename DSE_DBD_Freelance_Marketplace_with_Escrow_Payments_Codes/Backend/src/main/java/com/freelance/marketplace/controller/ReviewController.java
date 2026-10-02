package com.freelance.marketplace.controller;

import com.freelance.marketplace.dto.ReviewRequest;
import com.freelance.marketplace.entity.Review;
import com.freelance.marketplace.entity.User;
import com.freelance.marketplace.repository.UserRepository;
import com.freelance.marketplace.service.ReviewService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reviews")
public class ReviewController {

    private final ReviewService reviewService;
    private final UserRepository userRepository;

    public ReviewController(ReviewService reviewService, UserRepository userRepository) {
        this.reviewService = reviewService;
        this.userRepository = userRepository;
    }

    @PostMapping
    public ResponseEntity<Review> createReview(@AuthenticationPrincipal UserDetails userDetails,
                                              @Valid @RequestBody ReviewRequest request) {
        User reviewer = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.status(HttpStatus.CREATED).body(reviewService.createReview(reviewer, request));
    }

    @GetMapping("/me")
    public List<Review> myReviews(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return reviewService.getReviewsForUser(user);
    }

    @GetMapping("/written-by-me")
    public List<Review> reviewsWrittenByMe(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return reviewService.getReviewsWrittenByUser(user);
    }
}
