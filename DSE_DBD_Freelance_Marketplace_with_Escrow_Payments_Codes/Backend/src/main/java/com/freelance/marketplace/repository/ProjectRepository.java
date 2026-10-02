package com.freelance.marketplace.repository;

import com.freelance.marketplace.entity.Project;
import com.freelance.marketplace.entity.ProjectStatus;
import com.freelance.marketplace.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    List<Project> findByClient(User client);
    List<Project> findByStatus(ProjectStatus status);
    List<Project> findByClientAndStatus(User client, ProjectStatus status);
}
