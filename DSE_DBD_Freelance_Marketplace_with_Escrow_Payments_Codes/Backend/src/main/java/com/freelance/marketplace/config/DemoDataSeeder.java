package com.freelance.marketplace.config;

import com.freelance.marketplace.entity.*;
import com.freelance.marketplace.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

@Configuration
@Profile("demo")
@ConditionalOnProperty(name = "demo.seed.enabled", havingValue = "true")
public class DemoDataSeeder {
    private static final String CLIENT_EMAIL = "demo.client@example.com";
    private static final String FREELANCER_EMAIL = "demo.freelancer@example.com";
    private static final String ACTIVE_PROJECT_TITLE = "Demo: Marketplace website build";
    private static final String OPEN_PROJECT_TITLE = "Demo: Landing page redesign";

    @Bean
    CommandLineRunner seedDemoData(UserRepository userRepository,
                                   ProjectRepository projectRepository,
                                   ProposalRepository proposalRepository,
                                   ContractRepository contractRepository,
                                   EscrowAccountRepository escrowAccountRepository,
                                   MilestoneRepository milestoneRepository,
                                   MilestoneSubmissionRepository submissionRepository,
                                   DisputeRepository disputeRepository,
                                   MessageRepository messageRepository,
                                   NotificationRepository notificationRepository,
                                   PasswordEncoder passwordEncoder,
                                   @Value("${demo.client.password:DemoClient123!}") String clientPassword,
                                   @Value("${demo.freelancer.password:DemoFreelancer123!}") String freelancerPassword) {
        return args -> {
            User client = findOrCreateUser(userRepository, passwordEncoder, CLIENT_EMAIL, clientPassword,
                "Demo Client", Role.CLIENT, "DC", "A sample client account for demonstrating marketplace workflows.");
            client.setCompanyName("FreelanceHub Demo Studio");
            client.setCountry("India");
            client.setCity("Hyderabad");
            userRepository.save(client);

            User freelancer = findOrCreateUser(userRepository, passwordEncoder, FREELANCER_EMAIL, freelancerPassword,
                "Demo Freelancer", Role.FREELANCER, "DF", "A sample freelancer account for demonstrating project delivery.");
            freelancer.setProfessionalTitle("Full-Stack Developer");
            freelancer.setExperienceLevel("Expert");
            freelancer.setHourlyRate(new BigDecimal("1500"));
            freelancer.setSkills(List.of("React", "Java", "MySQL"));
            freelancer.setCountry("India");
            freelancer.setCity("Bengaluru");
            userRepository.save(freelancer);

            Project activeProject = findOrCreateProject(projectRepository, client, ACTIVE_PROJECT_TITLE,
                "A sample active project with an accepted proposal, funded escrow, milestone submissions, and a dispute.",
                new BigDecimal("18000"), ProjectStatus.IN_PROGRESS);
            Project openProject = findOrCreateProject(projectRepository, client, OPEN_PROJECT_TITLE,
                "An open demo project for browsing and submitting a new proposal during the presentation.",
                new BigDecimal("8000"), ProjectStatus.OPEN);

            Proposal proposal = proposalRepository.findFirstByProjectAndFreelancer(activeProject, freelancer)
                .orElseGet(() -> {
                    Proposal created = new Proposal(activeProject, freelancer, new BigDecimal("18000"), 21,
                        "I can deliver the storefront in clear, reviewable milestones.");
                    created.setStatus(ProposalStatus.ACCEPTED);
                    return proposalRepository.save(created);
                });
            proposal.setStatus(ProposalStatus.ACCEPTED);
            proposalRepository.save(proposal);

            Contract contract = contractRepository.findByProject(activeProject)
                .orElseGet(() -> contractRepository.save(new Contract(activeProject, client, freelancer, new BigDecimal("18000"))));
            contract.setStatus(ContractStatus.ACTIVE);
            contractRepository.save(contract);

            ensureMilestones(contract, milestoneRepository, submissionRepository);
            ensureFundedEscrow(contract, escrowAccountRepository);
            ensureDispute(contract, client, disputeRepository);
            ensureConversation(client, freelancer, messageRepository);
            ensureNotifications(client, freelancer, notificationRepository);
        };
    }

    private User findOrCreateUser(UserRepository repository, PasswordEncoder passwordEncoder, String email,
                                 String password, String name, Role role, String avatar, String bio) {
        return repository.findByEmail(email).map(existing -> {
            if (existing.getRole() != role) {
                throw new IllegalStateException("Demo email is already registered with a different role: " + email);
            }
            existing.setName(name);
            existing.setPassword(passwordEncoder.encode(password));
            existing.setAvatar(avatar);
            existing.setBio(bio);
            return existing;
        }).orElseGet(() -> repository.save(new User(name, email, passwordEncoder.encode(password), role, avatar, bio)));
    }

    private Project findOrCreateProject(ProjectRepository repository, User client, String title,
                                        String description, BigDecimal budget, ProjectStatus status) {
        return repository.findByClient(client).stream()
            .filter(project -> title.equals(project.getTitle()))
            .findFirst()
            .orElseGet(() -> {
                Project project = new Project(title, description, "Web Development", budget,
                    LocalDate.now().plusDays(30).toString(), List.of("React", "Java", "MySQL"), client);
                project.setStatus(status);
                return repository.save(project);
            });
    }

    private void ensureMilestones(Contract contract, MilestoneRepository milestoneRepository,
                                 MilestoneSubmissionRepository submissionRepository) {
        List<Milestone> milestones = milestoneRepository.findByContract(contract);
        if (milestones.isEmpty()) {
            Milestone planning = new Milestone(contract, "Planning & wireframes", new BigDecimal("6000"));
            Milestone implementation = new Milestone(contract, "Storefront implementation", new BigDecimal("6000"));
            implementation.setStatus(MilestoneStatus.SUBMITTED);
            implementation.setSubmissionFileName("demo-storefront-deliverable.txt");
            implementation.setSubmissionNote("Sample deliverable for reviewing and downloading during the presentation.");
            Milestone testing = new Milestone(contract, "Testing & handoff", new BigDecimal("6000"));
            testing.setStatus(MilestoneStatus.APPROVED);
            milestones = milestoneRepository.saveAll(List.of(planning, implementation, testing));
            byte[] fileData = "Synthetic demo deliverable. No real client data is included.\n".getBytes(StandardCharsets.UTF_8);
            milestones.get(1).setSubmissionFileSize((long) fileData.length);
            milestones.get(1).setSubmission(new MilestoneSubmission(milestones.get(1), fileData));
            milestoneRepository.save(milestones.get(1));
            return;
        }

        Milestone submitted = milestones.stream()
            .filter(milestone -> "Storefront implementation".equals(milestone.getName()))
            .findFirst()
            .orElse(null);
        if (submitted != null && submitted.getStatus() == MilestoneStatus.SUBMITTED
            && submissionRepository.findByMilestoneId(submitted.getId()).isEmpty()) {
            byte[] fileData = "Synthetic demo deliverable. No real client data is included.\n".getBytes(StandardCharsets.UTF_8);
            submitted.setSubmissionFileName("demo-storefront-deliverable.txt");
            submitted.setSubmissionFileSize((long) fileData.length);
            submitted.setSubmissionNote("Sample deliverable for reviewing and downloading during the presentation.");
            submitted.setSubmission(new MilestoneSubmission(submitted, fileData));
            milestoneRepository.save(submitted);
        }
    }

    private void ensureFundedEscrow(Contract contract, EscrowAccountRepository repository) {
        if (repository.findByContract(contract).isEmpty()) {
            EscrowAccount escrow = new EscrowAccount(contract);
            escrow.setTotalAmount(new BigDecimal("18000"));
            escrow.setAvailableAmount(new BigDecimal("18000"));
            escrow.setStatus(EscrowStatus.FUNDED);
            repository.save(escrow);
        }
    }

    private void ensureDispute(Contract contract, User client, DisputeRepository repository) {
        if (repository.findByContract(contract).isEmpty()) {
            repository.save(new Dispute(contract, client, "Demo dispute: delivery timeline",
                "This sample dispute demonstrates the dispute history available to both contract participants. It contains no real transaction or customer data."));
        }
    }

    private void ensureConversation(User client, User freelancer, MessageRepository repository) {
        String conversationId = Math.min(client.getId(), freelancer.getId()) + "-" + Math.max(client.getId(), freelancer.getId());
        if (repository.findByConversationIdOrderByCreatedAtAsc(conversationId).isEmpty()) {
            repository.save(new Message(client, freelancer, conversationId,
                "Welcome to the demo project. Let's use this conversation to coordinate the storefront milestones."));
        }
    }

    private void ensureNotifications(User client, User freelancer, NotificationRepository repository) {
        ensureNotification(client, "Demo flow: The sample active project and funded escrow are ready.", repository);
        ensureNotification(freelancer, "Demo flow: A sample deliverable is ready for client review.", repository);
    }

    private void ensureNotification(User recipient, String message, NotificationRepository repository) {
        boolean exists = repository.findByRecipientOrderByCreatedAtDesc(recipient).stream()
            .anyMatch(notification -> message.equals(notification.getMessage()));
        if (!exists) {
            repository.save(new Notification(recipient, message));
        }
    }
}
