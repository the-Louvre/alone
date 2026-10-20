package com.unispeaking.infrastructure.persistence.repository.session;

import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Serializes first-use preset registration through database uniqueness, including retries. */
@Repository
public class AgentPresetRepository {
    private final JdbcTemplate db;
    public AgentPresetRepository(JdbcTemplate db) { this.db=db; }
    public Map<String,Object> createOrFind(UUID user,String preset,UUID request,String config) {
        db.update("INSERT INTO conversation_agent(id,user_id,config,preset_key,preset_request_id) VALUES (?,?,?,?,?) ON CONFLICT DO NOTHING",
            UUID.randomUUID(),user,config,preset,request);
        var rows=db.queryForList("SELECT * FROM conversation_agent WHERE user_id=? AND (preset_key=? OR preset_request_id=?) ORDER BY CASE WHEN preset_request_id=? THEN 0 ELSE 1 END LIMIT 1",user,preset,request,request);
        return rows.getFirst();
    }
}
