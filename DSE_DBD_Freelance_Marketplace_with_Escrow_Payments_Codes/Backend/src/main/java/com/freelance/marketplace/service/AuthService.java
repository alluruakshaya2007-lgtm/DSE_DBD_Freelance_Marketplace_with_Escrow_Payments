package com.freelance.marketplace.service;

import com.freelance.marketplace.dto.AuthRequest;
import com.freelance.marketplace.dto.AuthResponse;
import com.freelance.marketplace.dto.RegisterRequest;
import com.freelance.marketplace.dto.UpdateProfileRequest;
import com.freelance.marketplace.entity.Role;
import com.freelance.marketplace.entity.User;
import com.freelance.marketplace.exception.BadRequestException;
import com.freelance.marketplace.repository.UserRepository;
import com.freelance.marketplace.security.JwtService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       AuthenticationManager authenticationManager,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (request.getConfirmPassword() != null && !request.getConfirmPassword().equals(request.getPassword())) {
            throw new BadRequestException("Passwords do not match");
        }

        if (userRepository.existsByEmail(request.getEmail().trim().toLowerCase())) {
            throw new BadRequestException("A user with this email already exists");
        }

        User user = new User();
        user.setName(request.getName().trim());
        user.setEmail(request.getEmail().trim().toLowerCase());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setRole(request.getRole() == null ? Role.CLIENT : request.getRole());
        user.setPhone(trimToNull(request.getPhone()));
        user.setCountry(trimToNull(request.getCountry()));
        user.setCity(trimToNull(request.getCity()));
        user.setCompanyName(trimToNull(request.getCompanyName()));
        user.setProfessionalTitle(trimToNull(request.getProfessionalTitle()));
        user.setExperienceLevel(trimToNull(request.getExperienceLevel()));
        user.setHourlyRate(request.getHourlyRate());
        user.setBio(trimToNull(request.getBio()));
        user.setSkills(normalizeSkills(request.getSkills()));
        user.setAvatar(buildAvatar(user.getName()));

        User saved = userRepository.save(user);
        String token = jwtService.generateToken(saved);
        return new AuthResponse(token, saved);
    }

    @Transactional
    public User updateProfile(String currentEmail, UpdateProfileRequest request) {
        User user = userRepository.findByEmail(currentEmail)
            .orElseThrow(() -> new BadRequestException("User not found"));

        String newEmail = request.getEmail().trim().toLowerCase();
        if (!newEmail.equals(user.getEmail()) && userRepository.existsByEmail(newEmail)) {
            throw new BadRequestException("A user with this email already exists");
        }

        user.setName(request.getName().trim());
        user.setEmail(newEmail);
        user.setPhone(trimToNull(request.getPhone()));
        user.setCountry(trimToNull(request.getCountry()));
        user.setCity(trimToNull(request.getCity()));
        user.setCompanyName(trimToNull(request.getCompanyName()));
        user.setProfessionalTitle(trimToNull(request.getProfessionalTitle()));
        user.setExperienceLevel(trimToNull(request.getExperienceLevel()));
        user.setHourlyRate(request.getHourlyRate());
        user.setBio(trimToNull(request.getBio()));
        user.setSkills(normalizeSkills(request.getSkills()));
        user.setAvatar(buildAvatar(user.getName()));
        user.setUpdatedAt(java.time.Instant.now());

        return userRepository.save(user);
    }

    public AuthResponse login(AuthRequest request) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.getEmail().trim().toLowerCase(), request.getPassword())
        );

        if (!authentication.isAuthenticated()) {
            throw new BadRequestException("Authentication failed");
        }

        User user = userRepository.findByEmail(request.getEmail().trim().toLowerCase())
            .orElseThrow(() -> new BadRequestException("User not found"));

        return new AuthResponse(jwtService.generateToken(user), user);
    }

    private String buildAvatar(String name) {
        String[] parts = name.trim().split("\\s+");
        if (parts.length == 1) {
            return parts[0].substring(0, 1).toUpperCase();
        }
        return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private java.util.List<String> normalizeSkills(java.util.List<String> skills) {
        java.util.List<String> normalized = new java.util.ArrayList<>();
        if (skills == null) {
            return normalized;
        }
        skills.stream()
            .filter(skill -> skill != null && !skill.trim().isEmpty())
            .map(String::trim)
            .distinct()
            .forEach(normalized::add);
        return normalized;
    }
}
