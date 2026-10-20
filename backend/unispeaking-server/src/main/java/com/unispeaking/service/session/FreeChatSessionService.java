package com.unispeaking.service.session;

import com.unispeaking.component.session.RealtimeSessionCoordinator;
import com.unispeaking.component.session.SessionLifecycleManager;
import com.unispeaking.domain.dto.scene.FreeChatSceneRequest;
import com.unispeaking.domain.dto.scene.FreeChatSceneContext;
import com.unispeaking.domain.dto.scene.SceneGenerationResponse;
import com.unispeaking.domain.dto.session.StartFreeChatRequest;
import com.unispeaking.domain.dto.session.Message;
import com.unispeaking.domain.dto.session.StartSceneSessionResponse;
import com.unispeaking.domain.dto.session.StartSessionCommand;
import com.unispeaking.domain.dto.session.StartSessionResponse;
import com.unispeaking.domain.vo.scene.SceneFlowStage;
import com.unispeaking.domain.vo.scene.SceneType;
import com.unispeaking.service.scene.FreeChatSceneService;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Free-chat session orchestration belongs to the session module. The scene
 * service is used only to generate the immutable scene prompt.
 */
@Service
public class FreeChatSessionService {

	private final FreeChatSceneService sceneService;
	private final SessionLifecycleManager sessionLifecycle;
	private final RealtimeSessionCoordinator sessionCoordinator;
	private com.unispeaking.service.agent.AgentWorkspaceService workspace;

	@org.springframework.beans.factory.annotation.Autowired
	public void setWorkspace(com.unispeaking.service.agent.AgentWorkspaceService workspace) { this.workspace = workspace; }

	public FreeChatSessionService(
			FreeChatSceneService sceneService,
			SessionLifecycleManager sessionLifecycle,
			RealtimeSessionCoordinator sessionCoordinator) {
		this.sceneService = sceneService;
		this.sessionLifecycle = sessionLifecycle;
		this.sessionCoordinator = sessionCoordinator;
	}
	public StartSceneSessionResponse startSession(StartFreeChatRequest request) {
		var agentConfig = request.conversationId() != null && !request.conversationId().isBlank()
				? workspace.conversationConfig(request.conversationId()) : request.agentConfig();
		FreeChatSceneContext prepared = agentConfig != null
				? workspace.prepare(agentConfig)
				: sceneService.prepare(new FreeChatSceneRequest(null));
		var generated = prepared.scene();
		String prompt = request.conversationId() != null && !request.conversationId().isBlank()
				? workspace.conversationPrompt(request.conversationId()) : generated.dialoguePrompt();
		SceneGenerationResponse scene = new SceneGenerationResponse(
				generated.sceneId(),
				List.of(),
				List.of(),
				List.of(),
				prompt);
		StartSessionResponse started = sessionLifecycle.startSession(
				new StartSessionCommand(
						prepared.userId(),
						generated.sceneId(),
						SceneType.FREE_CHAT,
						"DIALOGUE",
						prompt));
		try {
		if (agentConfig != null) workspace.attachVoice(started.sessionId(), agentConfig, prompt, request.conversationId());
		return sessionCoordinator.connect(
				scene,
				"Free Chat",
				SceneFlowStage.DIALOGUE,
				false,
				started,
				SceneType.FREE_CHAT,
				generated.sceneId(),
				prompt,
				request.offerSdp(),
				request.provider(),
				request.model(),
				agentConfig == null ? request.voice() : agentConfig.voice(),
				request.translationEnabled());
		} catch (RuntimeException error) {
			try { sessionLifecycle.terminateSceneSession(prepared.userId(), started.sessionId(),
				com.unispeaking.domain.vo.session.SessionStatus.FAILED, java.time.Instant.now()); }
			catch (RuntimeException cleanup) { error.addSuppressed(cleanup); }
			throw error;
		}
	}
	public void addMessage(String sessionId, Message message) {
		sessionLifecycle.addMessage(sessionId, message);
	}
	public Void endSession(String sessionId) {
		sessionLifecycle.endSession(sessionId);
		return null;
	}

}
