package com.freelance.marketplace.controller;

import com.freelance.marketplace.dto.ProjectRequest;
import com.freelance.marketplace.entity.Project;
import com.freelance.marketplace.entity.User;
import com.freelance.marketplace.repository.UserRepository;
import com.freelance.marketplace.service.ProjectService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projectService;
    private final UserRepository userRepository;

    public ProjectController(ProjectService projectService, UserRepository userRepository) {
        this.projectService = projectService;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<Project> getProjects() {
        return projectService.getAllProjects();
    }

    @GetMapping("/{projectId}")
    public Project getProject(@PathVariable Long projectId) {
        return projectService.getProjectById(projectId);
    }

    @PostMapping
    public ResponseEntity<Project> createProject(@AuthenticationPrincipal UserDetails userDetails,
                                               @Valid @RequestBody ProjectRequest request) {
        User client = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.status(HttpStatus.CREATED).body(projectService.createProject(client, request));
    }

    @GetMapping("/me")
    public List<Project> getMyProjects(@AuthenticationPrincipal UserDetails userDetails) {
        User client = userRepository.findByEmail(userDetails.getUsername())
            .orElseThrow(() -> new RuntimeException("User not found"));
        return projectService.getProjectsForClient(client);
    }
}
