package com.unispeaking.integration;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Runs every thread regression against a clean, migrated PostgreSQL database in CI. */
@Testcontainers
class AgentThreadsIT extends AgentThreadsContract {
    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine")
        .withDatabaseName("agent_threads_it").withUsername("unispeaking").withPassword("unispeaking");

    @DynamicPropertySource
    static void postgresProperties(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        properties.add("spring.datasource.username", POSTGRES::getUsername);
        properties.add("spring.datasource.password", POSTGRES::getPassword);
        properties.add("spring.datasource.driver-class-name", POSTGRES::getDriverClassName);
        properties.add("spring.flyway.enabled", () -> true);
        properties.add("spring.flyway.baseline-version", () -> "0");
        properties.add("spring.sql.init.mode", () -> "never");
    }
}
