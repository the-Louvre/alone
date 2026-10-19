package com.unispeaking.integration;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.unispeaking.common.exception.BusinessException;
import com.unispeaking.component.session.ActiveSessionRegistry;
import com.unispeaking.component.session.SessionLifecycleManager;
import com.unispeaking.domain.dto.agent.AgentModels.*;
import com.unispeaking.domain.dto.session.StartSessionCommand;
import com.unispeaking.domain.dto.session.StartSessionResponse;
import com.unispeaking.domain.po.session.FreeChatSceneSession;
import com.unispeaking.provider.AiProviderRegistry;
import com.unispeaking.service.agent.AgentWorkspaceService;
import com.unispeaking.service.auth.AuthService;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** Uses a dedicated disposable local database; never contacts an AI provider. */
@SpringBootTest(properties={
    "spring.datasource.url=jdbc:postgresql://127.0.0.1:55432/agent_chat_test",
    "spring.datasource.username=postgres", "spring.datasource.driver-class-name=org.postgresql.Driver",
    "spring.flyway.enabled=true", "spring.flyway.baseline-version=0", "spring.config.import="
})
@EnabledIfEnvironmentVariable(named="LOCAL_AGENT_DB_TESTS",matches="true")
@Transactional
class AgentThreadsLocalTest {
    @Autowired AgentWorkspaceService workspace;
    @Autowired JdbcTemplate db;
    @Autowired ActiveSessionRegistry sessions;
    @Autowired com.unispeaking.infrastructure.persistence.repository.session.AgentVoiceLeaseRepository leases;
    @MockitoBean AuthService auth;
    @MockitoBean AiProviderRegistry ai;
    @MockitoBean SessionLifecycleManager lifecycle;
    UUID user;
    @BeforeEach void setup() {
        user=UUID.randomUUID();
        db.update("INSERT INTO users(id,username,password_hash) VALUES (?,?,?)",user,user+"@example.test","test-only");
        when(auth.requireUserId(null)).thenReturn(user.toString());
        when(lifecycle.startSession(any(StartSessionCommand.class))).thenAnswer(call->{
            StartSessionCommand command=call.getArgument(0);String id="freechat_session_"+UUID.randomUUID().toString().replace("-","");
            db.update("INSERT INTO practice_session(session_id,user_id,scene_id,scene_type,status,started_at) VALUES (?,?,?,'FREE_CHAT','CREATED',now())",id,user,command.sceneId());
            return new StartSessionResponse(id,java.time.Instant.now().toString());
        });
        when(ai.executeLlmTask(anyString(),isNull())).thenReturn("A little shorter on the sides?");
    }
    Config config(String id,int version,String name,String prompt) { return new Config(id,version,name,"练习理发",prompt,"B1","Tina",1.0,"after"); }
    Config saved() {
        var record=workspace.save(null,config(null,0,"托尼","Talk about haircuts."));
        return config(record.get("id").toString(),1,"托尼","Talk about haircuts.");
    }
    String create(Config config) { return workspace.createThread(config,UUID.randomUUID().toString()).get("threadId").toString(); }
    List<?> messages(String id) { return (List<?>)workspace.threadDetail(id).get("messages"); }

    @Test void newerEmptyConversationsNeverHideTheLatestRealMessages() {
        Config config=saved();String good=create(config);
        workspace.threadTurn(good,new Turn(UUID.randomUUID().toString(),"I need a haircut."));
        create(config);create(config);
        var opened=workspace.openAgent(config.id());
        assertEquals(good,((Map<?,?>)opened.get("conversation")).get("threadId"));
        assertEquals(2,((List<?>)((Map<?,?>)opened.get("conversation")).get("messages")).size());
        assertEquals(3,workspace.threadHistory(config.id(),0).size());
    }
    @Test void openingAnAgentWithoutMessagesDoesNotAllocateAPracticeSession() {
        Config config=saved();
        assertNull(workspace.openAgent(config.id()).get("conversation"));
        assertEquals(0,db.queryForObject("SELECT count(*) FROM practice_session WHERE user_id=?",Integer.class,user));
        verifyNoInteractions(lifecycle,ai);
    }
    @Test void editsAndRenamesPreserveOldSnapshotsAndStableAgentHistory() {
        Config old=saved();String id=create(old);
        workspace.threadTurn(id,new Turn(UUID.randomUUID().toString(),"Hello Tony"));
        workspace.save(old.id(),config(old.id(),1,"托尼老师","Talk about styling."));
        assertEquals(old,workspace.conversationConfig(id));
        assertEquals(old.id(),workspace.threadDetail(id).get("agentId").toString());
        assertEquals(1,workspace.threadHistory(old.id(),0).size());
        Config latest=config(old.id(),2,"托尼老师","Talk about styling.");String next=create(latest);
        assertEquals(latest,workspace.conversationConfig(next));assertEquals(old,workspace.conversationConfig(id));
    }
    @Test void aVoiceConversationCanContinueInTextWithoutLosingItsMessagesOrSources() {
        Config config=saved();var segment=workspace.start(config);String session=segment.get("sessionId").toString(),id=segment.get("threadId").toString();
        db.update("UPDATE agent_conversation SET channel='voice' WHERE session_id=?",session);
        workspace.transcript(session,new Transcript("assistant:first",0,"Welcome back to the salon."));
        workspace.finishThread(id);
        workspace.threadTurn(id,new Turn(UUID.randomUUID().toString(),"Please keep the length."));
        assertEquals(3,messages(id).size());
        assertEquals(session,((Map<?,?>)messages(id).getFirst()).get("segmentId"));
        assertEquals(2,((List<?>)workspace.threadDetail(id).get("segments")).size());
        assertTrue(workspace.conversationPrompt(id).contains("Please keep the length."));
        workspace.collect(session,new Collect(1,"word","salon","理发店"));
        assertEquals(1,((List<?>)workspace.threadDetail(id).get("learning")).size());
    }
    @Test void creationMessageAndTranscriptRetriesAreIdempotent() {
        Config config=saved();String request=UUID.randomUUID().toString();var first=workspace.createThread(config,request);
        assertEquals(first.get("threadId"),workspace.createThread(config,request).get("threadId"));
        String id=first.get("threadId").toString();Turn turn=new Turn(UUID.randomUUID().toString(),"Hello");
        workspace.threadTurn(id,turn);workspace.threadTurn(id,turn);assertEquals(2,messages(id).size());
        verify(ai,times(1)).executeLlmTask(anyString(),isNull());
        var parts=(List<Map<String,Object>>)workspace.threadDetail(id).get("segments");String session=parts.getFirst().get("sessionId").toString();
        db.update("UPDATE agent_conversation SET channel='voice' WHERE session_id=?",session);
        Transcript input=new Transcript("user:event-one",1,"Just a trim.");workspace.transcript(session,input);workspace.transcript(session,input);
        assertEquals(3,messages(id).size());
        assertThrows(BusinessException.class,()->workspace.transcript(session,new Transcript("user:event-one",1,"Different text")));
    }
    @Test void aSecondVoiceConnectionAndTextWritesCannotInterruptAnActiveVoiceSegment() {
        Config config=saved();var segment=workspace.start(config);String session=segment.get("sessionId").toString(),id=segment.get("threadId").toString();
        db.update("UPDATE agent_conversation SET channel='voice' WHERE session_id=?",session);
        sessions.save(new FreeChatSceneSession(session,user.toString()));
        try {
            assertThrows(BusinessException.class,()->workspace.threadTurn(id,new Turn(UUID.randomUUID().toString(),"Hello")));
            assertThrows(BusinessException.class,()->workspace.attachVoice("another",config,"prompt",id));
            verifyNoInteractions(ai);
        } finally {sessions.remove(session);}
    }
    @Test void anotherUserCannotOpenContinueOrReadAnySegmentOrThread() {
        Config config=saved();var segment=workspace.start(config);String session=segment.get("sessionId").toString(),id=segment.get("threadId").toString();
        when(auth.requireUserId(null)).thenReturn(UUID.randomUUID().toString());
        assertThrows(BusinessException.class,()->workspace.threadDetail(id));
        assertThrows(BusinessException.class,()->workspace.openThread(id));
        assertThrows(BusinessException.class,()->workspace.openAgent(config.id()));
        assertThrows(BusinessException.class,()->workspace.detail(session));
        assertThrows(BusinessException.class,()->workspace.threadTurn(id,new Turn(UUID.randomUUID().toString(),"Hello")));
        assertThrows(BusinessException.class,()->workspace.transcript(session,new Transcript("event",1,"Hi")));
        assertTrue(workspace.threadHistory(null,0).isEmpty());
    }
    @Test void restartRecoveryRefundsUnusedReservationAndPreservesSavedTranscript() {
        Config config=saved();var segment=workspace.start(config);String session=segment.get("sessionId").toString();
        db.update("UPDATE agent_conversation SET channel='voice' WHERE session_id=?",session);
        workspace.transcript(session,new Transcript("assistant:kept",0,"Your old messages stay here."));
        db.update("UPDATE practice_session SET started_at=now()-interval '40 seconds' WHERE session_id=?",session);
        db.update("INSERT INTO user_entitlements(user_id,plan_code,plan_name,quota_date,quota_seconds,used_seconds,status) VALUES (?,'free','Free',current_date,600,600,'active')",user);
        db.update("INSERT INTO agent_voice_lease(session_id,user_id,quota_date,reserved_seconds,started_at,last_seen_at) VALUES (?,?,current_date,600,now()-interval '30 seconds',now()-interval '20 seconds')",session,user);
        leases.recover();
        assertEquals("INTERRUPTED",workspace.detail(session).get("status"));
        assertEquals(1,((List<?>)workspace.detail(session).get("messages")).size());
        assertEquals(10.0,db.queryForObject("SELECT used_seconds FROM user_entitlements WHERE user_id=?",Double.class,user),0.01);
        leases.recover();
        assertEquals(10.0,db.queryForObject("SELECT used_seconds FROM user_entitlements WHERE user_id=?",Double.class,user),0.01);
    }
    @Test void priorSessionLinksResolveToTheSameThreadAndSourceMessages() {
        Config config=saved();var original=workspace.start(config);String session=original.get("sessionId").toString();
        assertEquals(original.get("threadId"),workspace.detail(session).get("threadId"));
        assertEquals(config,workspace.detail(session).get("config"));
        workspace.finishThread(original.get("threadId").toString());
        assertEquals("COMPLETED",workspace.detail(session).get("status"));
    }
    @Test void deletionHidesHistoryAndDefaultChatWhileRestorePreservesMessagesSettingsAndCollections() {
        Config config=saved();String id=create(config);
        workspace.threadTurn(id,new Turn(UUID.randomUUID().toString(),"Just a trim."));
        String session=workspace.threadDetail(id).get("sessionId").toString();
        workspace.collect(session,new Collect(1,"word","trim","修剪"));
        var before=workspace.threadDetail(id);
        workspace.deleteThread(id);workspace.deleteThread(id);
        assertTrue(workspace.threadHistory(config.id(),0).isEmpty());
        assertTrue(workspace.history().isEmpty());
        assertNull(workspace.openAgent(config.id()).get("conversation"));
        assertEquals(1,workspace.threadHistory(config.id(),0,true).size());
        assertEquals(1,workspace.agents().size());assertEquals(1,workspace.learning().size());
        assertThrows(BusinessException.class,()->workspace.threadDetail(id));
        assertThrows(BusinessException.class,()->workspace.detail(session));
        assertThrows(BusinessException.class,()->workspace.threadTurn(id,new Turn(UUID.randomUUID().toString(),"Hello")));
        assertThrows(BusinessException.class,()->workspace.turn(session,new Turn(UUID.randomUUID().toString(),"Hello")));
        assertThrows(BusinessException.class,()->workspace.attachVoice("new-segment",config,"prompt",id));
        verify(ai,times(1)).executeLlmTask(anyString(),isNull());
        workspace.restoreThread(id);workspace.restoreThread(id);
        assertEquals(before.get("messages"),workspace.threadDetail(id).get("messages"));
        assertEquals(before.get("config"),workspace.threadDetail(id).get("config"));
        assertEquals(before.get("learning"),workspace.threadDetail(id).get("learning"));
        assertTrue(workspace.threadHistory(null,0,true).isEmpty());
        assertEquals(id,((Map<?,?>)workspace.openAgent(config.id()).get("conversation")).get("threadId"));
    }
    @Test void deletingCurrentChatFallsBackToAnEarlierMeaningfulChat() {
        Config config=saved();String first=create(config),second=create(config);
        workspace.threadTurn(first,new Turn(UUID.randomUUID().toString(),"First"));
        workspace.threadTurn(second,new Turn(UUID.randomUUID().toString(),"Second"));
        workspace.deleteThread(second);
        assertEquals(first,((Map<?,?>)workspace.openAgent(config.id()).get("conversation")).get("threadId"));
    }
    @Test void anotherUserCannotDeleteRestoreOrListTrashedHistory() {
        Config config=saved();String id=create(config);
        when(auth.requireUserId(null)).thenReturn(UUID.randomUUID().toString());
        assertThrows(BusinessException.class,()->workspace.deleteThread(id));
        assertThrows(BusinessException.class,()->workspace.restoreThread(id));
        assertTrue(workspace.threadHistory(null,0,true).isEmpty());
    }
    @Test void anActiveVoiceCannotBeDeleted() {
        Config config=saved();var segment=workspace.start(config);String session=segment.get("sessionId").toString(),id=segment.get("threadId").toString();
        db.update("UPDATE agent_conversation SET channel='voice' WHERE session_id=?",session);
        sessions.save(new FreeChatSceneSession(session,user.toString()));
        try {
            assertThrows(BusinessException.class,()->workspace.deleteThread(id));
            assertEquals(1,workspace.threadHistory(config.id(),0).size());
            assertTrue(workspace.threadHistory(config.id(),0,true).isEmpty());
        } finally {sessions.remove(session);}
    }
    @Test void legacyHistoryDeletionIsOwnedRecoverableAndDoesNotTouchMessages() {
        String id="freechat_session_"+UUID.randomUUID().toString().replace("-","");
        db.update("INSERT INTO practice_session(session_id,user_id,scene_id,scene_type,status,started_at) VALUES (?,?,?,'FREE_CHAT','COMPLETED',now())",id,user,"legacy-scene");
        db.update("INSERT INTO session_message(scene_id,session_id,message_no,owner,content) VALUES (?,?,1,0,'A legacy message')","legacy-scene",id);
        assertEquals(1,workspace.legacyHistory().size());
        sessions.save(new FreeChatSceneSession(id,user.toString()));
        try { assertThrows(BusinessException.class,()->workspace.changeLegacyTrash(id,true)); }
        finally {sessions.remove(id);}
        workspace.changeLegacyTrash(id,true);workspace.changeLegacyTrash(id,true);
        assertTrue(workspace.legacyHistory().isEmpty());assertEquals(1,workspace.legacyHistory(true).size());
        assertThrows(BusinessException.class,()->workspace.detail(id));
        when(auth.requireUserId(null)).thenReturn(UUID.randomUUID().toString());
        assertThrows(BusinessException.class,()->workspace.changeLegacyTrash(id,false));
        assertThrows(BusinessException.class,()->workspace.changeLegacyTrash(id,true));
        assertTrue(workspace.legacyHistory(true).isEmpty());
        when(auth.requireUserId(null)).thenReturn(user.toString());workspace.changeLegacyTrash(id,false);
        assertEquals(1,workspace.legacyHistory().size());
        assertEquals("A legacy message",((Map<?,?>)((List<?>)workspace.detail(id).get("messages")).getFirst()).get("content"));
    }

}
