package com.unispeaking.service.session;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.unispeaking.component.session.RealtimeSessionCoordinator;
import com.unispeaking.component.session.SessionLifecycleManager;
import com.unispeaking.domain.dto.scene.FreeChatSceneContext;
import com.unispeaking.domain.dto.scene.FreeChatSceneResult;
import com.unispeaking.domain.dto.session.Message;
import com.unispeaking.domain.dto.session.StartFreeChatRequest;
import com.unispeaking.domain.dto.session.StartSceneSessionResponse;
import com.unispeaking.domain.dto.session.StartSessionCommand;
import com.unispeaking.domain.dto.session.StartSessionResponse;
import com.unispeaking.domain.vo.provider.ProviderType;
import com.unispeaking.domain.vo.scene.SceneFlowStage;
import com.unispeaking.domain.vo.scene.SceneType;
import com.unispeaking.service.scene.FreeChatSceneService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class FreeChatSessionServiceTest {

	@Test
	void continuingVoiceUsesTheStoredSnapshotAndCleansUpFailedConnections() {
		var scenes=mock(FreeChatSceneService.class);
		var lifecycle=mock(SessionLifecycleManager.class);
		var coordinator=mock(RealtimeSessionCoordinator.class);
		var workspace=mock(com.unispeaking.service.agent.AgentWorkspaceService.class);
		var service=new FreeChatSessionService(scenes,lifecycle,coordinator);service.setWorkspace(workspace);
		var config=new com.unispeaking.domain.dto.agent.AgentModels.Config(null,1,"托尼","理发","Original prompt","B1","Tina",1.0,"after");
		when(workspace.conversationConfig("thread-one")).thenReturn(config);
		when(workspace.conversationPrompt("thread-one")).thenReturn("Original prompt with saved history");
		when(workspace.prepare(config)).thenReturn(new FreeChatSceneContext("user-one",new FreeChatSceneResult("scene-one","Original prompt")));
		when(lifecycle.startSession(any(StartSessionCommand.class))).thenReturn(new StartSessionResponse("session-one","time"));
		when(coordinator.connect(any(),any(),any(),any(Boolean.class),any(),any(),any(),any(),any(),any(),any(),any(),any())).thenThrow(new IllegalStateException("connection failed"));
		var request=new StartFreeChatRequest("offer",ProviderType.QWEN,"model","Harvey",true,null,"thread-one");
		org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class,()->service.startSession(request));
		verify(workspace).attachVoice("session-one",config,"Original prompt with saved history","thread-one");
		verify(coordinator).connect(any(),any(),any(),any(Boolean.class),any(),any(),any(),eq("Original prompt with saved history"),eq("offer"),eq(ProviderType.QWEN),eq("model"),eq("Tina"),eq(true));
		verify(lifecycle).terminateSceneSession(eq("user-one"),eq("session-one"),eq(com.unispeaking.domain.vo.session.SessionStatus.FAILED),any());
	}

	@Test
	void preparesSceneStartsLifecycleAndConnectsRealtime() {
		FreeChatSceneService scenes = mock(FreeChatSceneService.class);
		SessionLifecycleManager lifecycle = mock(SessionLifecycleManager.class);
		RealtimeSessionCoordinator coordinator = mock(RealtimeSessionCoordinator.class);
		FreeChatSessionService service = new FreeChatSessionService(
				scenes, lifecycle, coordinator);
		FreeChatSceneContext prepared = new FreeChatSceneContext(
				"user-1", new FreeChatSceneResult("free-1", "system prompt"));
		StartSessionResponse started = new StartSessionResponse("session-1", "time");
		StartSceneSessionResponse expected = mock(StartSceneSessionResponse.class);
		when(scenes.prepare(any())).thenReturn(prepared);
		when(lifecycle.startSession(any(StartSessionCommand.class))).thenReturn(started);
		when(coordinator.connect(
				any(), any(), any(), any(Boolean.class), any(), any(), any(), any(),
				any(), any(), any(), any(), any())).thenReturn(expected);

		StartFreeChatRequest request = new StartFreeChatRequest(
				"offer", ProviderType.QWEN, "qwen3.5-plus", "Tina", true);
		assertSame(expected, service.startSession(request));

		ArgumentCaptor<StartSessionCommand> command =
				ArgumentCaptor.forClass(StartSessionCommand.class);
		verify(lifecycle).startSession(command.capture());
		assertEquals("user-1", command.getValue().userId());
		assertEquals("free-1", command.getValue().sceneId());
		assertEquals(SceneType.FREE_CHAT, command.getValue().sceneType());
		assertEquals("DIALOGUE", command.getValue().stage());
		assertEquals("system prompt", command.getValue().prompt());
		verify(coordinator).connect(
				any(), eq("Free Chat"), eq(SceneFlowStage.DIALOGUE), eq(false),
				same(started), eq(SceneType.FREE_CHAT), eq("free-1"),
				eq("system prompt"), eq("offer"), eq(ProviderType.QWEN),
				eq("qwen3.5-plus"), eq("Tina"), eq(true));
	}

	@Test
	void delegatesMessagesAndReturnsNullAfterEndingSession() {
		SessionLifecycleManager lifecycle = mock(SessionLifecycleManager.class);
		FreeChatSessionService service = new FreeChatSessionService(
				mock(FreeChatSceneService.class),
				lifecycle,
				mock(RealtimeSessionCoordinator.class));
		Message message = new Message(1, "hello", null);

		service.addMessage("session-1", message);
		assertEquals(null, service.endSession("session-1"));
		verify(lifecycle).addMessage("session-1", message);
		verify(lifecycle).endSession("session-1");
	}
}
