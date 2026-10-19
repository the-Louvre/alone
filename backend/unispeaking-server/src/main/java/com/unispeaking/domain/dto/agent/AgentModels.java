package com.unispeaking.domain.dto.agent;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

public final class AgentModels {
    private AgentModels() {}

    public record Config(
        String id, Integer version,
        @NotBlank @Size(max=64) String name,
        @NotBlank @Size(max=2000) String purpose,
        @NotBlank @Size(max=12000) String prompt,
        @Pattern(regexp="A1|A2|B1|B2|C1|C2") @NotNull String level,
        @Pattern(regexp="Katerina|Harvey|Raymond|Aiden|Tina|Dolce") @NotNull String voice,
        @DecimalMin("0.5") @DecimalMax("1.5") @NotNull Double speed,
        @Pattern(regexp="gentle|after|on-request") @NotNull String correction) {}
    public record Generate(@NotBlank @Size(max=2000) String purpose,
        @Pattern(regexp="A1|A2|B1|B2|C1|C2") @NotNull String level) {}
    public record Start(@NotNull @Valid Config config) {}
    public record Turn(@NotBlank String requestId, @NotBlank @Size(max=4000) String text) {}
    public record Collect(@Min(1) int messageNo,
        @NotNull @Pattern(regexp="word|sentence") String kind,
        @NotBlank @Size(max=2000) String text, @Size(max=2000) String meaning) {}
    public record Attempt(@NotBlank String requestId, @NotBlank @Size(max=4000) String answer) {}
}
