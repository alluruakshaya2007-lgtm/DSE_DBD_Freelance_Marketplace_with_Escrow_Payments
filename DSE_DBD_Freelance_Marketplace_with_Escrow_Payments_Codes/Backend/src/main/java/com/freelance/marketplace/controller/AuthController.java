package com.freelance.marketplace.controller;

import com.freelance.marketplace.dto.AuthRequest;
import com.freelance.marketplace.dto.AuthResponse;
import com.freelance.marketplace.dto.RegisterRequest;
import com.freelance.marketplace.dto.UpdateProfileRequest;
import com.freelance.marketplace.entity.User;
import com.freelance.marketplace.repository.UserRepository;
import com.freelance.marketplace.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;

    public AuthController(AuthService authService, UserRepository userRepository) {
        this.authService = authService;
        this.userRepository = userRepository;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/me")
    public ResponseEntity<User> me(@AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(requireCurrentUser(userDetails));
    }

    @PutMapping("/me")
    public ResponseEntity<User> updateMe(@AuthenticationPrincipal UserDetails userDetails,
                                         @Valid @RequestBody UpdateProfileRequest request) {
        User updated = authService.updateProfile(requireCurrentUser(userDetails).getEmail(), request);
        return ResponseEntity.ok(updated);
    }

    private User requireCurrentUser(UserDetails userDetails) {
        if (userDetails == null) {
            throw new BadCredentialsException("Authentication required");
        }
        return userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new BadCredentialsException("Authentication required"));
    }
}
