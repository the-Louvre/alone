package com.unispeaking.controller;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.unispeaking.common.exception.BusinessException;
import com.unispeaking.common.exception.GlobalExceptionHandler;
import com.unispeaking.domain.dto.agent.AgentModels.Transcript;
import com.unispeaking.service.agent.AgentWorkspaceService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AgentWorkspaceControllerTest {
    private final AgentWorkspaceService service = mock(AgentWorkspaceService.class);
    private MockMvc mvc;
    @BeforeEach void setup() {
        mvc = MockMvcBuilders.standaloneSetup(new AgentWorkspaceController(service))
            .setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    @Test void historyDefaultsToVisibleRecordsAndBindsTrashScopeAndPagination() throws Exception {
        when(service.threadHistory(null,0,false)).thenReturn(List.of(Map.of("threadId","visible")));
        when(service.threadHistory("agent-one",50,true)).thenReturn(List.of(Map.of("threadId","deleted")));
        mvc.perform(get("/api/agent-workspace/threads"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].threadId").value("visible"));
        mvc.perform(get("/api/agent-workspace/threads").param("agentId","agent-one").param("offset","50").param("deleted","true"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].threadId").value("deleted"));
    }
    @Test void threadDeletionAndRestorationUseDistinctHttpMethods() throws Exception {
        when(service.deleteThread("thread-one")).thenReturn(Map.of("deleted",true));
        when(service.restoreThread("thread-one")).thenReturn(Map.of("restored",true));
        mvc.perform(delete("/api/agent-workspace/threads/thread-one"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true)).andExpect(jsonPath("$.data.deleted").value(true));
        mvc.perform(post("/api/agent-workspace/threads/thread-one/restore"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.restored").value(true));
        verify(service).deleteThread("thread-one");verify(service).restoreThread("thread-one");
    }
    @Test void legacyHistorySupportsTheSameTrashContract() throws Exception {
        when(service.legacyHistory(true)).thenReturn(List.of(Map.of("sessionId","old-one")));
        when(service.changeLegacyTrash("old-one",true)).thenReturn(Map.of("deleted",true));
        when(service.changeLegacyTrash("old-one",false)).thenReturn(Map.of("restored",true));
        mvc.perform(get("/api/agent-workspace/legacy-conversations").param("deleted","true"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].sessionId").value("old-one"));
        mvc.perform(delete("/api/agent-workspace/legacy-conversations/old-one"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.deleted").value(true));
        mvc.perform(post("/api/agent-workspace/legacy-conversations/old-one/restore"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.restored").value(true));
    }
    @Test void invalidTranscriptsAreRejectedBeforeReachingTheService() throws Exception {
        mvc.perform(post("/api/agent-workspace/conversations/session-one/transcripts")
            .contentType(MediaType.APPLICATION_JSON).content("{\"eventId\":\"\",\"owner\":2,\"text\":\"hello\"}"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.success").value(false));
        verifyNoInteractions(service);
        when(service.transcript("session-one",new Transcript("event-one",1,"Hello"))).thenReturn(Map.of("saved",true));
        mvc.perform(post("/api/agent-workspace/conversations/session-one/transcripts")
            .contentType(MediaType.APPLICATION_JSON).content("{\"eventId\":\"event-one\",\"owner\":1,\"text\":\"Hello\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.data.saved").value(true));
    }
    @Test void threadCreationValidatesNestedConfigAndRequestId() throws Exception {
        mvc.perform(post("/api/agent-workspace/threads").contentType(MediaType.APPLICATION_JSON)
            .content("{\"config\":{\"name\":\"\"},\"requestId\":\"\"}"))
            .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
    @Test void authenticationAndOwnershipFailuresRemainApiErrors() throws Exception {
        when(service.deleteThread("thread-one")).thenThrow(new BusinessException("AUTHENTICATION_REQUIRED","请登录"));
        when(service.restoreThread("thread-one")).thenThrow(new BusinessException("CONVERSATION_NOT_FOUND","对话不存在"));
        mvc.perform(delete("/api/agent-workspace/threads/thread-one"))
            .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("AUTHENTICATION_REQUIRED"));
        mvc.perform(post("/api/agent-workspace/threads/thread-one/restore"))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CONVERSATION_NOT_FOUND"));
    }
}
