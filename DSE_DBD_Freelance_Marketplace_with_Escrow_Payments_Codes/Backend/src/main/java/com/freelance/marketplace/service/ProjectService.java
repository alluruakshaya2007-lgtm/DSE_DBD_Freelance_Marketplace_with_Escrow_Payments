package com.freelance.marketplace.service;

import com.freelance.marketplace.dto.ProjectRequest;
import com.freelance.marketplace.entity.Project;
import com.freelance.marketplace.entity.ProjectStatus;
import com.freelance.marketplace.entity.Role;
import com.freelance.marketplace.entity.User;
import com.freelance.marketplace.exception.BadRequestException;
import com.freelance.marketplace.exception.ResourceNotFoundException;
import com.freelance.marketplace.repository.ProjectRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;

    public ProjectService(ProjectRepository projectRepository) {
        this.projectRepository = projectRepository;
    }

    @Transactional
    public Project createProject(User client, ProjectRequest request) {
        if (!Role.CLIENT.equals(client.getRole())) {
            throw new BadRequestException("Only clients can create projects");
        }
        Project project = new Project();
        project.setTitle(request.getTitle().trim());
        project.setDescription(request.getDescription().trim());
        project.setCategory(request.getCategory().trim());
        project.setBudget(request.getBudget());
        project.setDeadline(request.getDeadline().trim());
        project.setSkills(normalizeSkills(request.getSkills()));
        project.setClient(client);
        project.setStatus(ProjectStatus.OPEN);
        return         projectRepository.save(project);
    }

    private List<String> normalizeSkills(List<String> skills) {
        List<String> normalized = new java.util.ArrayList<>();
        if (skills == null) {
            return normalized;
        }
        skills.stream()
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(skill -> !skill.isEmpty())
            .distinct()
            .forEach(normalized::add);
        return normalized;
    }

    public List<Project> getAllProjects() {
        return projectRepository.findAll();
    }

    public List<Project> getProjectsForClient(User client) {
        return projectRepository.findByClient(client);
    }

    public Project getProjectById(Long id) {
        return projectRepository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Project not found with id " + id));
    }

    public void ensureClientOwnsProject(User client, Long projectId) {
        Project project = getProjectById(projectId);
        if (!project.getClient().getId().equals(client.getId())) {
            throw new BadRequestException("You can only manage your own projects");
        }
    }
}
