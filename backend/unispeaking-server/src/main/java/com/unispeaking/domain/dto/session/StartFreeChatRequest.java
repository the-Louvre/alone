package com.unispeaking.domain.dto.session;

import com.unispeaking.domain.vo.provider.ProviderType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.Valid;
import com.unispeaking.domain.dto.agent.AgentModels.Config;

public record StartFreeChatRequest(
		@NotBlank String offerSdp,
		ProviderType provider,
		String model,
		String voice,
		Boolean translationEnabled,
		@Valid Config agentConfig) {
	public StartFreeChatRequest(String offerSdp, ProviderType provider, String model, String voice, Boolean translationEnabled) {
		this(offerSdp, provider, model, voice, translationEnabled, null);
	}
}
