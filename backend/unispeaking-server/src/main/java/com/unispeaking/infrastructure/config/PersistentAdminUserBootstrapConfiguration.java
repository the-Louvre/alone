package com.unispeaking.infrastructure.config;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.util.StringUtils;

/**
 * Creates the shared administrator identity in the persistent user store.
 *
 * <p>The separate admin session store still owns the management-console
 * session, while this row is the durable learning identity used by the web
 * application, JWT claims, user preferences, entitlements and user-owned
 * learning records. The password is supplied only through the server
 * environment and is stored as a BCrypt hash.</p>
 */
@Configuration
@ConditionalOnProperty(
        name = "unispeaking.auth.persistence",
        havingValue = "postgres",
        matchIfMissing = true)
public class PersistentAdminUserBootstrapConfiguration {

    private static final UUID BOOTSTRAP_USER_ID =
            UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Bean
    ApplicationRunner persistentAdminUserBootstrap(
            JdbcTemplate jdbc,
            @Qualifier("userPasswordEncoder") PasswordEncoder passwordEncoder,
            @Value("${UNISPEAKING_ADMIN_BOOTSTRAP_PASSWORD:}") String bootstrapPassword,
            @Value("${unispeaking.auth.bootstrap-login:admin@unispeaking.local}") String configuredLogin,
            @Value("${unispeaking.auth.bootstrap-nickname:UniSpeaking Admin}") String configuredNickname) {
        return args -> {
            if (!StringUtils.hasText(bootstrapPassword)) {
                return;
            }

            String username = configuredLogin == null
                    ? "admin@unispeaking.local"
                    : configuredLogin.trim().toLowerCase(Locale.ROOT);
            if (!username.contains("@")) {
                throw new IllegalStateException("UNISPEAKING_ADMIN_LOGIN must be an email address");
            }
            String nickname = StringUtils.hasText(configuredNickname)
                    ? configuredNickname.trim()
                    : "UniSpeaking Admin";
            Instant now = Instant.now();
            String passwordHash = passwordEncoder.encode(bootstrapPassword);

            int updated = jdbc.update(
                    "update users set password_hash = ?, nickname = ?, role = 'ADMIN', "
                            + "status = 'ACTIVE', email_verified_at = coalesce(email_verified_at, ?), "
                            + "updated_at = ? where lower(username) = lower(?)",
                    passwordHash, nickname, Timestamp.from(now), Timestamp.from(now), username);
            if (updated == 0) {
                jdbc.update(
                        "insert into users (id, username, password_hash, nickname, role, status, "
                                + "auth_version, email_verified_at, created_at, updated_at) "
                                + "values (?, ?, ?, ?, 'ADMIN', 'ACTIVE', 0, ?, ?, ?)",
                        BOOTSTRAP_USER_ID,
                        username,
                        passwordHash,
                        nickname,
                        Timestamp.from(now),
                        Timestamp.from(now),
                        Timestamp.from(now));
            }

            UUID userId = findUserId(jdbc, username);
            jdbc.update(
                    "insert into user_entitlements (user_id, plan_code, plan_name, quota_date, "
                            + "quota_seconds, used_seconds, status, updated_at) "
                            + "values (?, 'free', 'Free', current_date, 600, 0, 'active', current_timestamp) "
                            + "on conflict (user_id) do nothing",
                    userId);
            jdbc.update(
                    "insert into user_preference (user_id, preferred_ai_speech_speed, preferences, "
                            + "created_at, updated_at) values (?, 'NATURAL', '{}'::jsonb, "
                            + "current_timestamp, current_timestamp) on conflict (user_id) do nothing",
                    userId);
        };
    }

    private UUID findUserId(JdbcTemplate jdbc, String username) {
        List<UUID> ids = jdbc.query(
                "select id from users where lower(username) = lower(?)",
                (resultSet, rowNumber) -> resultSet.getObject("id", UUID.class),
                username);
        if (ids.isEmpty()) {
            throw new IllegalStateException("Bootstrap administrator was not persisted");
        }
        return ids.getFirst();
    }
}
