package com.freelance.marketplace;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.ActiveProfiles;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.freelance.marketplace.dto.AuthRequest;
import com.freelance.marketplace.dto.RegisterRequest;
import com.freelance.marketplace.entity.Role;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class AuthenticationFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void rootAndHealthShouldBePublic() throws Exception {
        mockMvc.perform(get("/"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ok"));

        mockMvc.perform(get("/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void registerAndLoginShouldSucceed() throws Exception {
        String uniqueEmail = "aarav-" + UUID.randomUUID() + "@example.com";

        RegisterRequest registerRequest = new RegisterRequest();
        registerRequest.setName("Aarav Singh");
        registerRequest.setEmail(uniqueEmail);
        registerRequest.setPassword("securePass123");
        registerRequest.setConfirmPassword("securePass123");
        registerRequest.setRole(Role.FREELANCER);

        mockMvc.perform(post("/api/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(registerRequest)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token").exists())
            .andExpect(jsonPath("$.user.email").value(uniqueEmail));

        AuthRequest authRequest = new AuthRequest();
        authRequest.setEmail(uniqueEmail);
        authRequest.setPassword("securePass123");

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(authRequest)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token").exists());
    }
}
