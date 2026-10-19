package com.unispeaking.infrastructure.persistence.repository.session;

import com.unispeaking.component.policy.UserEntitlementPolicy;
import com.unispeaking.component.session.ActiveSessionRegistry;
import com.unispeaking.domain.po.session.AbstractSceneSession;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** Makes interrupted Agent voice reservations recoverable without losing transcripts. */
@Repository
@ConditionalOnProperty(name="spring.flyway.enabled",havingValue="true")
public class AgentVoiceLeaseRepository {
    private final JdbcTemplate db;
    private final UserEntitlementPolicy policy;
    private final ActiveSessionRegistry active;
    public AgentVoiceLeaseRepository(JdbcTemplate db,UserEntitlementPolicy policy,ActiveSessionRegistry active) {
        this.db=db;this.policy=policy;this.active=active;
    }
    public void record(AbstractSceneSession session) {
        if(!session.hasQuotaReservation())return;
        db.update("INSERT INTO agent_voice_lease(session_id,user_id,quota_date,reserved_seconds,started_at,last_seen_at) "
            +"SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM agent_conversation WHERE session_id=? AND channel='voice') ON CONFLICT(session_id) DO NOTHING",
            session.getId(),UUID.fromString(session.getUserId()),session.getQuotaDate(),session.getQuotaReservedSeconds(),
            Timestamp.from(session.getQuotaStartedAt()),Timestamp.from(Instant.now()),session.getId());
    }
    public void clear(String id) { db.update("DELETE FROM agent_voice_lease WHERE session_id=?",id); }
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void recover() {
        var rows=db.queryForList("SELECT l.*,p.status FROM agent_voice_lease l JOIN practice_session p USING(session_id) FOR UPDATE OF l SKIP LOCKED");
        for(var row:rows) {
            String id=row.get("session_id").toString();if(active.findById(id).isPresent())continue;
            if(!java.util.List.of("COMPLETED","FAILED","INTERRUPTED").contains(row.get("status"))) {
                Instant started=((java.sql.Timestamp)row.get("started_at")).toInstant();
                Instant lastSeen=((java.sql.Timestamp)row.get("last_seen_at")).toInstant();
                policy.settleReservation(row.get("user_id").toString(),((java.sql.Date)row.get("quota_date")).toLocalDate(),
                    ((Number)row.get("reserved_seconds")).doubleValue(),started,lastSeen);
                db.update("UPDATE practice_session SET status='INTERRUPTED',ended_at=?,updated_at=now() WHERE session_id=?",Timestamp.from(lastSeen),id);
            }
            clear(id);
        }
    }
}
