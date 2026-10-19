package com.unispeaking.integration;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.unispeaking.common.exception.BusinessException;
import com.unispeaking.component.session.SessionLifecycleManager;
import com.unispeaking.domain.dto.agent.AgentModels.*;
import com.unispeaking.domain.dto.session.StartSessionCommand;
import com.unispeaking.domain.dto.session.StartSessionResponse;
import com.unispeaking.provider.AiProviderRegistry;
import com.unispeaking.service.agent.AgentWorkspaceService;
import com.unispeaking.service.auth.AuthService;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
class AgentWorkspaceIT {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17-alpine")
        .withDatabaseName("agent_it").withUsername("unispeaking").withPassword("unispeaking");
    @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",POSTGRES::getJdbcUrl);
        r.add("spring.datasource.username",POSTGRES::getUsername);
        r.add("spring.datasource.password",POSTGRES::getPassword);
        r.add("spring.datasource.driver-class-name",POSTGRES::getDriverClassName);
        r.add("spring.flyway.enabled",()->true);
        r.add("spring.flyway.baseline-version",()->"0");
        r.add("spring.sql.init.mode",()->"never");
    }
    @Autowired AgentWorkspaceService service;
    @Autowired JdbcTemplate db;
    @MockitoBean AuthService auth;
    @MockitoBean AiProviderRegistry ai;
    @MockitoBean SessionLifecycleManager lifecycle;
    UUID user;
    Config config(String prompt) { return new Config(null,null,"旅行搭子","伦敦点餐",prompt,"B1","Katerina",1.0,"after"); }
    @BeforeEach void setup() {
        user=UUID.randomUUID();
        db.update("INSERT INTO users(id,username,password_hash) VALUES (?,?,?)",user,user+"@example.test","test-only");
        when(auth.requireUserId(null)).thenReturn(user.toString());
        when(lifecycle.startSession(any(StartSessionCommand.class))).thenAnswer(call->{
            StartSessionCommand c=call.getArgument(0); String id=UUID.randomUUID().toString();
            db.update("INSERT INTO practice_session(session_id,user_id,scene_id,scene_type,status,started_at) VALUES (?,?,?,'FREE_CHAT','CREATED',now())",id,user,c.sceneId());
            return new StartSessionResponse(id,java.time.Instant.now().toString());
        });
    }
    @Test void snapshotsKeepEditedPromptAndAgentsAreUserOwned() {
        var saved=service.save(null,config("Use the exact topic: pottery. Never ask about travel."));
        String agentId=(String)saved.get("id");
        var initial=new Config(agentId,1,"陶艺聊友","聊陶艺","Talk about pottery only.","B2","Harvey",0.9,"on-request");
        String id=(String)service.start(initial).get("sessionId");
        service.save(agentId,new Config(agentId,1,"新名字","聊电影","Talk about films.","C1","Tina",1.0,"gentle"));
        assertEquals(initial,service.detail(id).get("config"));
        String system=db.queryForObject("SELECT system_prompt FROM agent_conversation WHERE session_id=?",String.class,id);
        assertTrue(system.contains(initial.prompt())); assertTrue(system.contains("B2")); assertTrue(system.contains("only when explicitly asked"));
        assertEquals(1,service.history().size());
        when(auth.requireUserId(null)).thenReturn(UUID.randomUUID().toString());
        assertTrue(service.agents().isEmpty()); assertTrue(service.history().isEmpty());
        assertThrows(BusinessException.class,()->service.detail(id));
        assertThrows(BusinessException.class,()->service.start(initial));
    }
    @Test void retriesDoNotDuplicateMessagesCollectionsOrPracticeAndPreserveSources() {
        String id=(String)service.start(config("Chat naturally.")).get("sessionId");
        when(ai.executeLlmTask(anyString(),isNull())).thenReturn("Would you like a cup of tea?");
        Turn turn=new Turn(UUID.randomUUID().toString(),"Hello!");
        service.turn(id,turn); service.turn(id,turn);
        assertEquals(2,db.queryForObject("SELECT count(*) FROM session_message WHERE session_id=?",Integer.class,id));
        verify(ai,times(1)).executeLlmTask(anyString(),isNull());
        Collect collect=new Collect(2,"word","cup of tea","一杯茶");
        service.collect(id,collect);service.collect(id,collect);
        assertEquals(1,service.learning().size());
        var item=service.learning().getFirst();
        assertEquals(id,item.get("sessionId")); assertEquals("Would you like a cup of tea?",item.get("sourceText"));
        assertThrows(BusinessException.class,()->service.collect(id,new Collect(2,"word","invented text","")));
        when(ai.executeLlmTask(anyString(),isNull())).thenReturn("表达自然：I'd like a cup of tea.");
        Attempt attempt=new Attempt(UUID.randomUUID().toString(),"I'd like a cup of tea.");
        service.practice((String)item.get("id"),attempt);service.practice((String)item.get("id"),attempt);
        assertEquals(1,service.attempts().size());
        service.finish(id);assertEquals("COMPLETED",service.detail(id).get("status"));
        assertThrows(BusinessException.class,()->service.turn(id,new Turn(UUID.randomUUID().toString(),"Another")));
        assertEquals(2,((List<?>)service.detail(id).get("messages")).size());
    }
    @Test void providerFailuresLeaveNoPartialTurnAndAnotherSessionCannotOverwriteHistory() {
        String first=(String)service.start(config("First prompt")).get("sessionId");
        String second=(String)service.start(config("Second prompt")).get("sessionId");
        when(ai.executeLlmTask(anyString(),isNull())).thenThrow(new IllegalStateException("provider unavailable"));
        Turn input=new Turn(UUID.randomUUID().toString(),"Hello");
        assertThrows(IllegalStateException.class,()->service.turn(first,input));
        assertEquals(0,((List<?>)service.detail(first).get("messages")).size());
        doReturn("Hello there.").when(ai).executeLlmTask(anyString(),isNull());
        service.turn(first,input);
        assertEquals(2,((List<?>)service.detail(first).get("messages")).size());
        assertEquals(0,((List<?>)service.detail(second).get("messages")).size());
        assertEquals(2,service.history().size());
    }
}
