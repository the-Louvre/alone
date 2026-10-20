package com.unispeaking.integration;

import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.context.TestPropertySource;

/** Opt-in local runner; never uses the application database. */
@EnabledIfEnvironmentVariable(named="LOCAL_AGENT_DB_TESTS",matches="true")
@TestPropertySource(properties={
    "spring.datasource.url=jdbc:postgresql://127.0.0.1:55432/agent_chat_test",
    "spring.datasource.username=postgres", "spring.datasource.driver-class-name=org.postgresql.Driver",
    "spring.flyway.enabled=true", "spring.flyway.baseline-version=0", "spring.config.import="
})
class AgentThreadsLocalTest extends AgentThreadsContract {}
