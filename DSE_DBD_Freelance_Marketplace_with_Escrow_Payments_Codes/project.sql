CREATE DATABASE IF NOT EXISTS freelance_marketplace
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE freelance_marketplace;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    avatar VARCHAR(255),
    phone VARCHAR(255),
    country VARCHAR(255),
    city VARCHAR(255),
    company_name VARCHAR(255),
    professional_title VARCHAR(255),
    experience_level VARCHAR(255),
    hourly_rate DECIMAL(12, 2),
    bio VARCHAR(1000),
    completed_projects INT,
    earnings DECIMAL(19, 2),
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS user_skills (
    user_id BIGINT NOT NULL,
    skill VARCHAR(255),
    CONSTRAINT fk_user_skills_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS projects (
    id BIGINT NOT NULL AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(2000),
    category VARCHAR(255) NOT NULL,
    budget DECIMAL(19, 2) NOT NULL,
    deadline VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    client_id BIGINT NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_projects_client (client_id),
    KEY idx_projects_status (status),
    CONSTRAINT fk_projects_client FOREIGN KEY (client_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS project_skills (
    project_id BIGINT NOT NULL,
    skill VARCHAR(255),
    KEY idx_project_skills_project (project_id),
    CONSTRAINT fk_project_skills_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS proposals (
    id BIGINT NOT NULL AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    freelancer_id BIGINT NOT NULL,
    bid_amount DECIMAL(19, 2) NOT NULL,
    estimated_days INT NOT NULL,
    cover_letter VARCHAR(2000),
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_proposals_project_freelancer (project_id, freelancer_id),
    KEY idx_proposals_freelancer (freelancer_id),
    CONSTRAINT fk_proposals_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_proposals_freelancer FOREIGN KEY (freelancer_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contracts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    client_id BIGINT NOT NULL,
    freelancer_id BIGINT NOT NULL,
    contract_amount DECIMAL(19, 2) NOT NULL,
    total_amount DECIMAL(19, 2) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_contracts_project (project_id),
    KEY idx_contracts_client (client_id),
    KEY idx_contracts_freelancer (freelancer_id),
    CONSTRAINT fk_contracts_project FOREIGN KEY (project_id) REFERENCES projects (id),
    CONSTRAINT fk_contracts_client FOREIGN KEY (client_id) REFERENCES users (id),
    CONSTRAINT fk_contracts_freelancer FOREIGN KEY (freelancer_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS escrow_accounts (
    id BIGINT NOT NULL AUTO_INCREMENT,
    contract_id BIGINT NOT NULL,
    total_amount DECIMAL(19, 2) NOT NULL,
    available_amount DECIMAL(19, 2) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_escrow_contract (contract_id),
    CONSTRAINT fk_escrow_contract FOREIGN KEY (contract_id) REFERENCES contracts (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS milestones (
    id BIGINT NOT NULL AUTO_INCREMENT,
    contract_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(19, 2) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    submission_file_name VARCHAR(255),
    submission_file_size BIGINT,
    submission_note VARCHAR(2000),
    review_feedback VARCHAR(2000),
    PRIMARY KEY (id),
    KEY idx_milestones_contract (contract_id),
    CONSTRAINT fk_milestones_contract FOREIGN KEY (contract_id) REFERENCES contracts (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
    id BIGINT NOT NULL AUTO_INCREMENT,
    escrow_account_id BIGINT NOT NULL,
    milestone_id BIGINT,
    payer_id BIGINT NOT NULL,
    payee_id BIGINT NOT NULL,
    amount DECIMAL(19, 2) NOT NULL,
    description VARCHAR(255) NOT NULL,
    transaction_reference VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_payments_milestone (milestone_id),
    KEY idx_payments_payer (payer_id),
    KEY idx_payments_payee (payee_id),
    CONSTRAINT fk_payments_escrow FOREIGN KEY (escrow_account_id) REFERENCES escrow_accounts (id),
    CONSTRAINT fk_payments_milestone FOREIGN KEY (milestone_id) REFERENCES milestones (id),
    CONSTRAINT fk_payments_payer FOREIGN KEY (payer_id) REFERENCES users (id),
    CONSTRAINT fk_payments_payee FOREIGN KEY (payee_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages (
    id BIGINT NOT NULL AUTO_INCREMENT,
    sender_id BIGINT NOT NULL,
    receiver_id BIGINT NOT NULL,
    conversation_id VARCHAR(255) NOT NULL,
    text VARCHAR(4000) NOT NULL,
    read_flag BIT(1) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_messages_conversation_created (conversation_id, created_at),
    KEY idx_messages_sender (sender_id),
    KEY idx_messages_receiver (receiver_id),
    CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users (id),
    CONSTRAINT fk_messages_receiver FOREIGN KEY (receiver_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS disputes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    contract_id BIGINT NOT NULL,
    raised_by_id BIGINT NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description VARCHAR(4000) NOT NULL,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_disputes_contract (contract_id),
    CONSTRAINT fk_disputes_contract FOREIGN KEY (contract_id) REFERENCES contracts (id),
    CONSTRAINT fk_disputes_raised_by FOREIGN KEY (raised_by_id) REFERENCES users (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reviews (
    id BIGINT NOT NULL AUTO_INCREMENT,
    reviewer_id BIGINT NOT NULL,
    reviewee_id BIGINT NOT NULL,
    contract_id BIGINT NOT NULL,
    rating INT NOT NULL,
    comment VARCHAR(2000),
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_reviews_reviewee (reviewee_id),
    UNIQUE KEY uk_reviews_contract_reviewer (contract_id, reviewer_id),
    CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users (id),
    CONSTRAINT fk_reviews_reviewee FOREIGN KEY (reviewee_id) REFERENCES users (id),
    CONSTRAINT fk_reviews_contract FOREIGN KEY (contract_id) REFERENCES contracts (id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT NOT NULL AUTO_INCREMENT,
    recipient_id BIGINT NOT NULL,
    message VARCHAR(500) NOT NULL,
    read_flag BIT(1) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_notifications_recipient_created (recipient_id, created_at),
    CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;
