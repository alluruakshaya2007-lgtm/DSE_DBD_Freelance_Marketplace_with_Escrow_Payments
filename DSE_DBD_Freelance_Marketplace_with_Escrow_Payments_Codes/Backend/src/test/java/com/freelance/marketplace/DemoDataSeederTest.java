package com.freelance.marketplace;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.freelance.marketplace.dto.AuthRequest;
import com.freelance.marketplace.entity.Contract;
import com.freelance.marketplace.entity.EscrowStatus;
import com.freelance.marketplace.entity.Milestone;
import com.freelance.marketplace.entity.MilestoneSubmission;
import com.freelance.marketplace.entity.ProjectStatus;
import com.freelance.marketplace.entity.Role;
import com.freelance.marketplace.entity.User;
import com.freelance.marketplace.repository.ContractRepository;
import com.freelance.marketplace.repository.DisputeRepository;
import com.freelance.marketplace.repository.EscrowAccountRepository;
import com.freelance.marketplace.repository.MilestoneSubmissionRepository;
import com.freelance.marketplace.repository.MessageRepository;
import com.freelance.marketplace.repository.MilestoneRepository;
import com.freelance.marketplace.repository.ProjectRepository;
import com.freelance.marketplace.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:demo-seed;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "demo.seed.enabled=true"
})
@AutoConfigureMockMvc
@ActiveProfiles("demo")
class DemoDataSeederTest {
    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProjectRepository projectRepository;

    @Autowired
    private ContractRepository contractRepository;

    @Autowired
    private EscrowAccountRepository escrowAccountRepository;

    @Autowired
    private MilestoneRepository milestoneRepository;

    @Autowired
    private MilestoneSubmissionRepository submissionRepository;

    @Autowired
    private DisputeRepository disputeRepository;

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    @Qualifier("seedDemoData")
    private CommandLineRunner seedDemoData;

    @Test
    void seedsRepeatableClientAndFreelancerDemoWorkflows() throws Exception {
        User client = userRepository.findByEmail("demo.client@example.com").orElseThrow();
        User freelancer = userRepository.findByEmail("demo.freelancer@example.com").orElseThrow();
        assertEquals(Role.CLIENT, client.getRole());
        assertEquals(Role.FREELANCER, freelancer.getRole());
        assertTrue(passwordEncoder.matches("DemoClient123!", client.getPassword()));
        assertTrue(passwordEncoder.matches("DemoFreelancer123!", freelancer.getPassword()));

        List<Contract> contracts = contractRepository.findByClient(client);
        assertEquals(1, contracts.size());
        Contract contract = contracts.get(0);
        List<Milestone> milestones = milestoneRepository.findByContract(contract);
        assertEquals(3, milestones.size());
        Milestone submittedMilestone = milestones.stream()
            .filter(milestone -> milestone.getSubmissionFileName() != null)
            .findFirst()
            .orElseThrow();
        MilestoneSubmission submission = submissionRepository.findByMilestoneId(submittedMilestone.getId()).orElseThrow();
        assertTrue(submission.getFileData().length > 0);
        assertEquals(EscrowStatus.FUNDED, escrowAccountRepository.findByContract(contract).orElseThrow().getStatus());
        assertEquals(1, disputeRepository.findByContract(contract).size());
        assertEquals(1, projectRepository.findByClientAndStatus(client,
            ProjectStatus.OPEN).size());
        assertEquals(1, messageRepository.findBySenderOrReceiverOrderByCreatedAtAsc(client, client).size());

        seedDemoData.run();

        assertEquals(2, userRepository.count());
        assertEquals(2, projectRepository.findByClient(client).size());
        assertEquals(1, contractRepository.findByClient(client).size());
        assertEquals(3, milestoneRepository.findByContract(contract).size());
        assertEquals(1, disputeRepository.findByContract(contract).size());
    }

    @Test
    void demoClientAndFreelancerCanLogIn() throws Exception {
        assertLogin("demo.client@example.com", "DemoClient123!", "CLIENT");
        assertLogin("demo.freelancer@example.com", "DemoFreelancer123!", "FREELANCER");
    }

    @Test
    void bothDemoParticipantsCanDownloadTheSubmittedDeliverable() throws Exception {
        Milestone submittedMilestone = milestoneRepository.findAll().stream()
            .filter(milestone -> "demo-storefront-deliverable.txt".equals(milestone.getSubmissionFileName()))
            .findFirst()
            .orElseThrow();
        String expectedContent = "Synthetic demo deliverable. No real client data is included.\n";

        assertDownload("demo.client@example.com", "DemoClient123!", submittedMilestone.getId(), expectedContent);
        assertDownload("demo.freelancer@example.com", "DemoFreelancer123!", submittedMilestone.getId(), expectedContent);
    }

    private void assertDownload(String email, String password, Long milestoneId, String expectedContent) throws Exception {
        AuthRequest request = new AuthRequest();
        request.setEmail(email);
        request.setPassword(password);
        String token = mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        String jwt = objectMapper.readTree(token).get("token").asText();

        mockMvc.perform(get("/api/escrow/milestones/{milestoneId}/submission", milestoneId)
                .header("Authorization", "Bearer " + jwt))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("demo-storefront-deliverable.txt")))
            .andExpect(content().bytes(expectedContent.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    }

    private void assertLogin(String email, String password, String role) throws Exception {
        AuthRequest request = new AuthRequest();
        request.setEmail(email);
        request.setPassword(password);

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.user.role").value(role));
    }
}
