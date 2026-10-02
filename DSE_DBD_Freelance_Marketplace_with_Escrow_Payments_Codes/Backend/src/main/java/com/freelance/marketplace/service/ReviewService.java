package com.freelance.marketplace.service;

import com.freelance.marketplace.dto.ReviewRequest;
import com.freelance.marketplace.entity.Contract;
import com.freelance.marketplace.entity.Review;
import com.freelance.marketplace.entity.User;
import com.freelance.marketplace.exception.BadRequestException;
import com.freelance.marketplace.exception.ResourceNotFoundException;
import com.freelance.marketplace.repository.ContractRepository;
import com.freelance.marketplace.repository.ReviewRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final ContractRepository contractRepository;
    private final NotificationService notificationService;

    public ReviewService(ReviewRepository reviewRepository, ContractRepository contractRepository,
                         NotificationService notificationService) {
        this.reviewRepository = reviewRepository;
        this.contractRepository = contractRepository;
        this.notificationService = notificationService;
    }

    @Transactional
    public Review createReview(User reviewer, ReviewRequest request) {
        Contract contract = contractRepository.findById(request.getContractId())
            .orElseThrow(() -> new ResourceNotFoundException("Contract not found with id " + request.getContractId()));

        boolean isReviewerPartOfContract = contract.getClient().getId().equals(reviewer.getId())
            || contract.getFreelancer().getId().equals(reviewer.getId());
        if (!isReviewerPartOfContract) {
            throw new BadRequestException("Only participants of the contract can leave a review");
        }
        if (contract.getStatus() != com.freelance.marketplace.entity.ContractStatus.COMPLETED) {
            throw new BadRequestException("Reviews are available after the contract is completed");
        }
        if (reviewRepository.existsByContractAndReviewer(contract, reviewer)) {
            throw new BadRequestException("You have already reviewed this contract");
        }

        User reviewee = contract.getClient().getId().equals(reviewer.getId()) ? contract.getFreelancer() : contract.getClient();
        Review review = new Review(reviewer, reviewee, contract, request.getRating(), request.getComment());
        Review savedReview = reviewRepository.save(review);
        notificationService.notify(reviewee, "You received a new contract review.");
        return savedReview;
    }

    public List<Review> getReviewsForUser(User user) {
        return reviewRepository.findByReviewee(user);
    }

    public List<Review> getReviewsWrittenByUser(User user) {
        return reviewRepository.findByReviewer(user);
    }
}
