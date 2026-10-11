package com.unispeaking.service.auth.impl;

import com.unispeaking.common.exception.BusinessException;
import com.unispeaking.domain.dto.auth.AuthResponse;
import com.unispeaking.domain.dto.auth.ChangePasswordRequest;
import com.unispeaking.domain.dto.auth.ChangePasswordResponse;
import com.unispeaking.domain.dto.auth.LoginRequest;
import com.unispeaking.domain.dto.auth.RegisterRequest;
import com.unispeaking.domain.dto.auth.UserAccountResponse;
import com.unispeaking.domain.po.auth.UserAccount;
import com.unispeaking.domain.po.auth.UserRole;
import com.unispeaking.domain.po.auth.UserStatus;
import com.unispeaking.domain.vo.auth.IssuedJwt;
import com.unispeaking.service.auth.AuthService;
import com.unispeaking.service.auth.JwtTokenService;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * Development-only authentication adapter. It keeps the UI and JWT contract
 * intact while allowing the product and Agent work to run before the user
 * identity database is configured.
 */
@Service
@Primary
@ConditionalOnProperty(name = "unispeaking.auth.mock-enabled", havingValue = "true")
public final class MockAuthService implements AuthService {

    private static final UUID DEFAULT_USER_ID =
            UUID.fromString("10000000-0000-0000-0000-000000000001");

    private final JwtTokenService jwtTokenService;
    private final String defaultEmail;
    private final String defaultNickname;
    private final boolean acceptAnyCredentials;
    private final String configuredPassword;

    public MockAuthService(
            JwtTokenService jwtTokenService,
            @Value("${UNISPEAKING_MOCK_USER_EMAIL:demo@unispeaking.local}") String defaultEmail,
            @Value("${UNISPEAKING_MOCK_USER_NICKNAME:Demo Learner}") String defaultNickname,
            @Value("${UNISPEAKING_MOCK_ACCEPT_ANY_CREDENTIALS:true}") boolean acceptAnyCredentials,
            @Value("${UNISPEAKING_MOCK_USER_PASSWORD:UniSpeaking-Dev-2026!}") String configuredPassword) {
        this.jwtTokenService = jwtTokenService;
        this.defaultEmail = normalizeEmail(defaultEmail);
        this.defaultNickname = StringUtils.hasText(defaultNickname) ? defaultNickname.trim() : "Demo Learner";
        this.acceptAnyCredentials = acceptAnyCredentials;
        this.configuredPassword = configuredPassword == null ? "" : configuredPassword;
    }

    @Override
    public AuthResponse register(RegisterRequest request) {
        return authenticate(request.username(), request.password(), request.nickname());
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        return authenticate(request.username(), request.password(), null);
    }

    @Override
    public UserAccountResponse currentUser() {
        return UserAccountResponse.from(requireAuthenticatedUser());
    }

    @Override
    public ChangePasswordResponse changePassword(ChangePasswordRequest request) {
        requireAuthenticatedUser();
        return ChangePasswordResponse.required();
    }

    @Override
    public String currentUserIdOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            return null;
        }
        return jwt.getSubject();
    }

    @Override
    public String requireUserId(String requestedUserId) {
        return requireAuthenticatedUser().id().toString();
    }

    @Override
    public String requireAdminUserId() {
        UserAccount user = requireAuthenticatedUser();
        if (user.role() != UserRole.ADMIN) {
            throw new BusinessException("ADMIN_ACCESS_DENIED", "当前账号没有反馈处理权限");
        }
        return user.id().toString();
    }

    private AuthResponse authenticate(String rawEmail, String rawPassword, String nickname) {
        String email = normalizeEmail(rawEmail);
        if (!acceptAnyCredentials && !configuredPassword.equals(rawPassword)) {
            throw new BusinessException("INVALID_CREDENTIALS", "邮箱或密码错误");
        }
        Instant now = Instant.now();
        UserAccount user = new UserAccount(
                stableUserId(email),
                email,
                "mock",
                StringUtils.hasText(nickname) ? nickname.trim() : defaultNickname,
                UserRole.USER,
                UserStatus.ACTIVE,
                0,
                now,
                now,
                now);
        IssuedJwt issued = jwtTokenService.issue(user);
        return new AuthResponse("Bearer", issued.token(), issued.expiresAt(), UserAccountResponse.from(user));
    }

    private UserAccount requireAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof Jwt jwt)
                || !StringUtils.hasText(jwt.getSubject())) {
            throw new BusinessException("AUTHENTICATION_REQUIRED", "请先登录");
        }
        UUID id;
        try {
            id = UUID.fromString(jwt.getSubject());
        }
        catch (IllegalArgumentException exception) {
            throw new BusinessException("INVALID_ACCESS_TOKEN", "Access Token 中的用户标识无效");
        }
        String username = jwt.getClaimAsString("username");
        String role = jwt.getClaimAsString("role");
        return new UserAccount(
                id,
                StringUtils.hasText(username) ? username : defaultEmail,
                "mock",
                defaultNickname,
                "ADMIN".equalsIgnoreCase(role) ? UserRole.ADMIN : UserRole.USER,
                UserStatus.ACTIVE,
                0,
                null,
                Instant.now(),
                Instant.now());
    }

    private static String normalizeEmail(String value) {
        String email = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (!email.contains("@") || email.startsWith("@") || email.endsWith("@")) {
            throw new BusinessException("INVALID_EMAIL", "请输入有效邮箱地址");
        }
        return email;
    }

    private static UUID stableUserId(String email) {
        return email.equals("demo@unispeaking.local")
                ? DEFAULT_USER_ID
                : UUID.nameUUIDFromBytes(("unispeaking-mock:" + email).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
