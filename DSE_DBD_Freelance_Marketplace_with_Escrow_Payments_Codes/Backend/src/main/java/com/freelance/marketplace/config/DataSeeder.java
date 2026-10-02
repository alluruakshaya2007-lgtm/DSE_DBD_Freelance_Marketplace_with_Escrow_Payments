package com.freelance.marketplace.config;

import com.freelance.marketplace.entity.*;
import com.freelance.marketplace.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.math.BigDecimal;
import java.util.List;

@Configuration
@Profile("h2")
public class DataSeeder {

    @Bean
    CommandLineRunner seedData(UserRepository userRepository,
                              ProjectRepository projectRepository,
                              ProposalRepository proposalRepository,
                              ContractRepository contractRepository,
                              EscrowAccountRepository escrowAccountRepository,
                              MilestoneRepository milestoneRepository,
                              PaymentRepository paymentRepository,
                              PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.count() > 0) {
                return;
            }

            User client = new User("Rahul Kumar", "client@example.com", passwordEncoder.encode("client123"), Role.CLIENT,
                "RK", "Product lead focused on delivering polished experiences.");
            client.setPhone("+91 98450 12345");
            client.setCountry("India");
            client.setCity("Hyderabad");
            client.setCompanyName("Northwind Retail");

            User freelancer = new User("Alex Johnson", "freelancer@example.com", passwordEncoder.encode("freelancer123"), Role.FREELANCER,
                "AJ", "Full-stack developer building dependable product experiences.");
            freelancer.setPhone("+91 98450 67890");
            freelancer.setCountry("India");
            freelancer.setCity("Bengaluru");
            freelancer.setProfessionalTitle("Full-Stack Developer");
            freelancer.setExperienceLevel("Expert");
            freelancer.setHourlyRate(new BigDecimal("1500"));
            freelancer.setSkills(List.of("React", "Node.js", "UI Design", "TypeScript"));

            User secondFreelancer = new User("Priya Sharma", "priya@example.com", passwordEncoder.encode("priya123"), Role.FREELANCER,
                "PS", "UX designer creating customer-first experiences.");
            secondFreelancer.setPhone("+91 98450 22222");
            secondFreelancer.setCountry("India");
            secondFreelancer.setCity("Pune");
            secondFreelancer.setProfessionalTitle("Product Designer");
            secondFreelancer.setExperienceLevel("Intermediate");
            secondFreelancer.setHourlyRate(new BigDecimal("1100"));
            secondFreelancer.setSkills(List.of("Figma", "Mobile UX", "Research"));

            userRepository.saveAll(List.of(client, freelancer, secondFreelancer));

            Project project = new Project(
                "React E-Commerce Website",
                "Build a modern storefront with product discovery, cart, secure authentication and order management for a growing retail brand.",
                "Web Development",
                new BigDecimal("20000"),
                "30 Sep 2026",
                List.of("React", "Node.js", "MongoDB"),
                client
            );
            project.setStatus(ProjectStatus.IN_PROGRESS);
            projectRepository.save(project);

            Proposal proposal = new Proposal(project, freelancer, new BigDecimal("18000"), 18,
                "I can build a fast, maintainable storefront with a polished checkout experience.");
            proposal.setStatus(ProposalStatus.ACCEPTED);
            proposalRepository.save(proposal);

            Contract contract = new Contract(project, client, freelancer, new BigDecimal("18000"));
            contract.setStatus(ContractStatus.ACTIVE);
            contract = contractRepository.save(contract);

            EscrowAccount escrowAccount = new EscrowAccount(contract);
            escrowAccount.setTotalAmount(new BigDecimal("18000"));
            escrowAccount.setAvailableAmount(new BigDecimal("13000"));
            escrowAccount.setStatus(EscrowStatus.PARTIALLY_RELEASED);
            escrowAccountRepository.save(escrowAccount);

            Milestone milestoneOne = new Milestone(contract, "UI Design & Prototype", new BigDecimal("5000"));
            milestoneOne.setStatus(MilestoneStatus.PAID);
            Milestone milestoneTwo = new Milestone(contract, "Frontend Development", new BigDecimal("7000"));
            milestoneTwo.setStatus(MilestoneStatus.APPROVED);
            Milestone milestoneThree = new Milestone(contract, "Testing & Delivery", new BigDecimal("6000"));
            milestoneThree.setStatus(MilestoneStatus.PENDING);
            milestoneRepository.saveAll(List.of(milestoneOne, milestoneTwo, milestoneThree));

            Payment payment = new Payment(escrowAccount, milestoneOne, client, freelancer, new BigDecimal("5000"),
                "Simulated payment release for milestone 1", "SIM-1001");
            payment.setStatus(PaymentStatus.RELEASED);
            paymentRepository.save(payment);
        };
    }
}
